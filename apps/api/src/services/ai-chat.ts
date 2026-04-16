/**
 * AI Chat service.
 * Integrates with OpenAI to provide an intelligent scheduling assistant.
 * The assistant can understand natural language requests and execute scheduling actions
 * (set requirements, generate schedules, replace employees) via OpenAI's native tool calling.
 */
import OpenAI from "openai";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift, comparePeriods } from "../entities/Shift";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { fillNewShifts } from "./scheduler";
import { handleMockChat } from "./mock/mock-chat";
import { executeAction, type ParsedAction } from "./action-executor";

/** Returns true when a valid OpenAI key is configured */
function hasOpenAIKey(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Lazily initialized OpenAI client singleton */
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Please configure it in apps/api/.env"
      );
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Builds a text snapshot of the current scheduling state (employees, requirements, shifts)
 * to be included in the system prompt so the AI model has full context.
 */
async function buildContext(scheduleId: number): Promise<string> {
  const employees = await AppDataSource.getRepository(Employee).find();
  const schedule = await AppDataSource.getRepository(Schedule).findOneOrFail({
    where: { id: scheduleId },
  });
  const shifts = (
    await AppDataSource.getRepository(Shift).find({
      where: { scheduleId },
      relations: ["assignedEmployee"],
      order: { date: "ASC" },
    })
  ).sort((a, b) => a.date.localeCompare(b.date) || comparePeriods(a.period, b.period));
  const requirements = await AppDataSource.getRepository(
    ScheduleRequirement
  ).find({
    where: { scheduleId },
  });

  const empList = employees
    .map(
      (e) =>
        `  [ID:${e.id}] ${e.name} (${e.role}, ${
          e.maxHoursPerWeek
        }h/wk, available: ${(() => {
          try {
            return (JSON.parse(e.availability) as number[])
              .map((d: number) => DAYS[d])
              .join(", ");
          } catch {
            return "invalid availability data";
          }
        })()})`
    )
    .join("\n");

  const shiftSummary =
    shifts.length > 0
      ? shifts
          .map(
            (s) =>
              `  [ShiftID:${s.id}] ${s.date} (${
                DAYS[new Date(s.date + "T00:00:00Z").getUTCDay()]
              }) ${s.period} — ${s.role}: ${
                s.assignedEmployee?.name || "UNFILLED"
              }`
          )
          .join("\n")
      : "  No shifts generated yet.";

  const reqSummary =
    requirements.length > 0
      ? [...new Set(requirements.map((r) => r.dayOfWeek))]
          .sort()
          .map((day) => {
            const dayReqs = requirements.filter((r) => r.dayOfWeek === day);
            const details = dayReqs
              .map((r) => `${r.period}: ${r.requiredCount} ${r.role}s`)
              .join(", ");
            return `  ${DAYS[day]}: ${details}`;
          })
          .join("\n")
      : "  No requirements set yet.";

  return `
CURRENT DATE: ${new Date().toISOString().split("T")[0]}
SCHEDULE: "${schedule.name}" (${schedule.startDate} to ${schedule.endDate})
SCHEDULE ID: ${scheduleId}

EMPLOYEES (${employees.length} total):
${empList}

CURRENT REQUIREMENTS:
${reqSummary}

CURRENT SHIFTS (${shifts.length} total):
${shiftSummary}
`.trim();
}

/**
 * System prompt that instructs the AI model on its role and scheduling rules.
 * Action format instructions are no longer needed — the model uses native tool calling.
 */
const SYSTEM_PROMPT = `You are a restaurant scheduling assistant. You help managers set up staffing requirements and generate schedules.

You have tools available to execute scheduling actions. Use them whenever the user requests an operation.

IMPORTANT RULES FOR REQUIREMENTS:
- dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- roles: "cook", "waiter", "dishwasher", "manager"
- periods: "morning", "afternoon", "evening"
- set_requirements MERGES with existing requirements — only include entries you want to add or change, NOT all existing ones
- If the user says "weekdays", that means Monday(1) through Friday(5)
- If the user says "weekends", that means Saturday(6) and Sunday(0)
- To remove a requirement, set its requiredCount to 0

RULES:
- generate_schedule requires requirements to be set first. If none exist, set them first.
- After any action, shifts are automatically filled — you do NOT need to call generate_schedule after setting requirements.
- Only use generate_schedule when the user explicitly asks to regenerate/recreate the entire schedule from scratch (it deletes all existing shifts).
- When replacing, find the correct shift ID from the context.
- If a replacement request matches multiple shifts (e.g. "replace Camila on Friday" and she has both an afternoon and evening shift), use replace_employee_batch with all matching shift IDs instead of multiple replace_employee calls.
- SWAPPING — there are TWO different meanings. Pick the right one:
  A) "Swap A FOR B at [time]" / "Put B in A's place on [time]" / "Replace A with B" → the user wants a SPECIFIC person (B) to take over A's shift.
     → Use assign_employee: find A's shift ID at the specified time, then assign employee B to it.
  B) "Swap A and B" / "Exchange A's and B's shifts" (no specific time, implies both move) → the user wants both employees to switch to each other's shift.
     → Use swap_employees: find A's shift → shiftIdA, find B's shift → shiftIdB, call swap_employees(shiftIdA, shiftIdB).
     → The two shifts MUST be different (different period or date). Only swap employees with the same role.
  In BOTH cases, do NOT use replace_employee — it picks a random replacement, not the intended one.
- Always be helpful and explain what you did.
- Use the employee names and shift IDs from the CONTEXT.
- ALWAYS call the appropriate tool when the user is requesting an action. Never respond with just information when an action is needed.`;

/**
 * OpenAI tool definitions for the scheduling actions.
 * These provide structured JSON Schema so the model produces validated tool calls.
 */
const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "set_requirements",
      description:
        "Set or update staffing requirements for the schedule. Merges with existing requirements — only include entries to add or change.",
      parameters: {
        type: "object",
        required: ["requirements"],
        properties: {
          requirements: {
            type: "array",
            items: {
              type: "object",
              required: ["dayOfWeek", "role", "period", "requiredCount"],
              properties: {
                dayOfWeek: {
                  type: "number",
                  description:
                    "Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)",
                },
                role: {
                  type: "string",
                  enum: ["cook", "waiter", "dishwasher", "manager"],
                },
                period: {
                  type: "string",
                  enum: ["morning", "afternoon", "evening"],
                },
                requiredCount: {
                  type: "number",
                  description:
                    "Number of employees needed. Set to 0 to remove.",
                },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_schedule",
      description:
        "Regenerate ALL shifts from scratch based on requirements. WARNING: deletes all existing shifts first. Only use when user explicitly asks to regenerate the entire schedule.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_employee",
      description:
        "Replace the assigned employee on a single shift with the next best available employee.",
      parameters: {
        type: "object",
        required: ["shiftId"],
        properties: {
          shiftId: {
            type: "number",
            description: "The ID of the shift to reassign.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_employee_batch",
      description:
        "Replace employees on multiple shifts at once. Use when a replacement request matches more than one shift.",
      parameters: {
        type: "object",
        required: ["shiftIds"],
        properties: {
          shiftIds: {
            type: "array",
            items: { type: "number" },
            description: "Array of shift IDs to reassign.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_shifts",
      description:
        "Delete shifts from the schedule. Filter by date, period, role, or provide specific shift IDs. All filters are optional and combined with AND logic.",
      parameters: {
        type: "object",
        properties: {
          shiftIds: {
            type: "array",
            items: { type: "number" },
            description:
              "Specific shift IDs to delete. If provided, other filters are ignored.",
          },
          date: {
            type: "string",
            description: "Delete shifts on this date (YYYY-MM-DD format).",
          },
          period: {
            type: "string",
            enum: ["morning", "afternoon", "evening"],
            description: "Delete shifts in this period only.",
          },
          role: {
            type: "string",
            enum: ["cook", "waiter", "dishwasher", "manager"],
            description: "Delete shifts for this role only.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_employee",
      description:
        "Assign a specific employee to a shift by their IDs. Use this when the user wants a particular person on a particular shift.",
      parameters: {
        type: "object",
        required: ["shiftId", "employeeId"],
        properties: {
          shiftId: {
            type: "number",
            description: "The ID of the shift to assign.",
          },
          employeeId: {
            type: "number",
            description: "The ID of the employee to assign.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unassign_employee",
      description:
        "Remove the assigned employee from one or more shifts, leaving them as unfilled. Does not delete the shift.",
      parameters: {
        type: "object",
        required: ["shiftIds"],
        properties: {
          shiftIds: {
            type: "array",
            items: { type: "number" },
            description: "The shift IDs to unassign.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_employees",
      description:
        "Swap two employees between their respective shifts. shiftIdA is the shift currently assigned to employee A, shiftIdB is the shift currently assigned to employee B. After the swap, employee A will be on shift B and employee B will be on shift A. The two shifts must be different (different date or period).",
      parameters: {
        type: "object",
        required: ["shiftIdA", "shiftIdB"],
        properties: {
          shiftIdA: {
            type: "number",
            description:
              "The shift ID where employee A is currently assigned (employee A will LEAVE this shift).",
          },
          shiftIdB: {
            type: "number",
            description:
              "The shift ID where employee B is currently assigned (employee B will LEAVE this shift).",
          },
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Main chat handler
// ---------------------------------------------------------------------------

/**
 * Main chat handler. When an OpenAI key is available, sends the user message
 * (with conversation history and current scheduling context) to OpenAI using
 * native tool calling. Otherwise falls back to a simple pattern-matching mock.
 */
export async function handleChatMessage(
  message: string,
  history: { role: string; content: string }[],
  scheduleId: number
): Promise<{
  reply: string;
  actions: { type: string; success: boolean; message: string }[];
}> {
  // Fallback to mock mode when no OpenAI key is configured
  if (!hasOpenAIKey()) {
    return handleMockChat(message, scheduleId);
  }

  // Build the context for the AI model
  const context = await buildContext(scheduleId);

  // Create the messages for the AI model
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context}`,
    },
    ...history.map(
      (m) =>
        ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        } as OpenAI.ChatCompletionMessageParam)
    ),
    { role: "user", content: message },
  ];

  // Initialize the action results
  const actionResults: { type: string; success: boolean; message: string }[] =
    [];

  // Tool-call loop: keep calling OpenAI until we get a final text response
  // This is a loop that will continue until we get a final text response from the AI model
  // or we have reached the maximum number of rounds
  const MAX_ROUNDS = 5;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Call the OpenAI API to get the completion (this is the main call to the AI model)
    const completion = await getOpenAI().chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      tools: TOOLS,
      // Deterministic tool calls for destructive actions (assign, delete, swap).
      temperature: 0,
    });

    // Get the choice from the completion (models can return multiple choices, we only want the first one)
    const choice = completion.choices[0];
    const assistantMessage = choice.message;

    // Add the assistant's message to the conversation
    messages.push(assistantMessage);

    // If no tool calls, we have the final text response
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      // Auto-fill shifts after any actions were executed
      if (actionResults.length > 0) {
        try {
          const fillResult = await fillNewShifts(scheduleId);
          if (fillResult.added > 0) {
            actionResults.push({
              type: "auto_fill",
              success: true,
              message: `Auto-filled ${fillResult.added} shifts (${fillResult.filled} assigned, ${fillResult.unfilled} unfilled)`,
            });
          }
        } catch (err) {
          // Non-critical — don't fail the response, but surface in logs
          // so silent failures don't mislead the UI.
          console.error(
            "Auto-fill after chat actions failed:",
            err instanceof Error ? { message: err.message, stack: err.stack } : err,
          );
        }
      }

      const reply =
        assistantMessage.content || "Sorry, I couldn't process that.";
      return { reply, actions: actionResults };
    }

    // Execute each tool call and feed results back
    for (const toolCall of assistantMessage.tool_calls) {
      // Check if the tool call is a function
      if (toolCall.type !== "function") continue;

      // Parse the arguments from the tool call. The model can occasionally emit
      // malformed JSON; swallow the parse error and feed a structured failure
      // back to the model so it can retry or apologize instead of crashing the
      // whole request (which would lose any successful actions in this round).
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseErr) {
        const message =
          parseErr instanceof Error ? parseErr.message : "Invalid JSON";
        const failure = {
          type: toolCall.function.name,
          success: false,
          message: `Invalid tool arguments from model: ${message}`,
        };
        actionResults.push(failure);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(failure),
        });
        continue;
      }

      const action: ParsedAction = {
        type: toolCall.function.name,
        ...args,
      };

      // Execute the action
      const result = await executeAction(action, scheduleId);
      actionResults.push(result);

      // Add the tool result so the model can see what happened
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Safety: if we exhaust rounds, auto-fill and return what we have
  if (actionResults.length > 0) {
    try {
      const fillResult = await fillNewShifts(scheduleId);
      if (fillResult.added > 0) {
        actionResults.push({
          type: "auto_fill",
          success: true,
          message: `Auto-filled ${fillResult.added} shifts (${fillResult.filled} assigned, ${fillResult.unfilled} unfilled)`,
        });
      }
    } catch (err) {
      console.error(
        "Auto-fill after MAX_ROUNDS exhaustion failed:",
        err instanceof Error ? { message: err.message, stack: err.stack } : err,
      );
    }
  }

  // We hit the MAX_ROUNDS cap without the model producing a final text reply.
  // Don't claim success — tell the user the run was truncated so they can
  // verify the schedule and re-issue whatever didn't land.
  return {
    reply:
      "I reached the action limit before finishing this request. Some steps may be incomplete — please review the schedule and let me know if anything is missing.",
    actions: actionResults,
  };
}
