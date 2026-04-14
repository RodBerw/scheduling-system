/**
 * AI Chat service.
 * Integrates with OpenAI to provide an intelligent scheduling assistant.
 * The assistant can understand natural language requests and execute scheduling actions
 * (set requirements, generate schedules, replace employees) via OpenAI's native tool calling.
 */
import OpenAI from "openai";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift } from "../entities/Shift";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import {
  generateSchedule,
  fillNewShifts,
  replaceEmployee,
  replaceEmployeeBatch,
} from "./scheduler";

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
  const shifts = await AppDataSource.getRepository(Shift).find({
    where: { scheduleId },
    relations: ["assignedEmployee"],
    order: { date: "ASC", period: "ASC" },
  });
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
];

interface ParsedAction {
  type: string;
  [key: string]: unknown;
}

/**
 * Executes a single parsed action against the database.
 * Supports: set_requirements, generate_schedule, replace_employee.
 */
async function executeAction(
  action: ParsedAction,
  scheduleId: number
): Promise<{ type: string; success: boolean; message: string }> {
  switch (action.type) {
    case "set_requirements": {
      const { requirements } = action as {
        type: string;
        requirements: {
          dayOfWeek: number;
          role: string;
          period: string;
          requiredCount: number;
        }[];
      };

      // Check if the requirements are valid
      if (!requirements || !Array.isArray(requirements)) {
        return {
          type: action.type,
          success: false,
          message: "Invalid requirements format",
        };
      }

      // Merge with existing requirements instead of replacing all
      const repo = AppDataSource.getRepository(ScheduleRequirement);
      const existing = await repo.find({ where: { scheduleId } });

      // Iterate through the requirements
      const saved: ScheduleRequirement[] = [];
      for (const r of requirements) {
        // Check if the requirement already exists
        const match = existing.find(
          (e) =>
            e.dayOfWeek === r.dayOfWeek &&
            e.role === r.role &&
            e.period === r.period
        );
        if (match) {
          // If the requirement is being removed, remove it
          if (r.requiredCount === 0) {
            await repo.remove(match);
          } else {
            // If the requirement is being updated, update it
            match.requiredCount = r.requiredCount;
            saved.push(await repo.save(match));
          }
        } else if (r.requiredCount > 0) {
          // If the requirement is new, create it
          const entity = repo.create({
            ...r,
            scheduleId,
          } as Partial<ScheduleRequirement>);
          saved.push(await repo.save(entity));
        }
      }
      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Set ${saved.length} staffing requirements`,
      };
    }
    case "generate_schedule": {
      try {
        // Generate the schedule
        const shifts = await generateSchedule(scheduleId);

        // Count the number of filled shifts
        const filled = shifts.filter((s) => s.assignedEmployeeId).length;

        // Count the number of unfilled shifts
        const unfilled = shifts.length - filled;

        // Return the success message
        return {
          type: action.type,
          success: true,
          message: `Generated ${shifts.length} shifts (${filled} filled, ${unfilled} unfilled)`,
        };
      } catch (err: unknown) {
        // Return the error message
        const msg = err instanceof Error ? err.message : "Generation failed";
        return { type: action.type, success: false, message: msg };
      }
    }
    case "replace_employee": {
      const { shiftId } = action as { shiftId: number; type: string };

      // Check if the shift ID is valid
      if (!shiftId) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftId",
        };
      }

      // Replace the employee on the shift
      const shift = await replaceEmployee(shiftId);

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: shift.assignedEmployee
          ? `Replaced with ${shift.assignedEmployee.name} on ${shift.date} ${shift.period}`
          : `Could not find a replacement for ${shift.role} on ${shift.date} ${shift.period}`,
      };
    }
    case "replace_employee_batch": {
      const { shiftIds } = action as { shiftIds: number[]; type: string };

      // Check if the shift IDs are valid
      if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
        return {
          type: action.type,
          success: false,
          message: "Missing or empty shiftIds array",
        };
      }

      // Replace the employees on the shifts
      const shifts = await replaceEmployeeBatch(shiftIds);

      // Count the number of replaced shifts
      const replaced = shifts.filter((s) => s.assignedEmployee).length;

      // Count the number of unfilled shifts
      const unfilled = shifts.length - replaced;

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Processed ${shifts.length} shifts (${replaced} replaced, ${unfilled} unfilled)`,
      };
    }
    case "delete_shifts": {
      const { shiftIds, date, period, role } = action as {
        type: string;
        shiftIds?: number[];
        date?: string;
        period?: string;
        role?: string;
      };

      // Get the shift repository
      const repo = AppDataSource.getRepository(Shift);

      if (shiftIds && shiftIds.length > 0) {
        // Delete the shifts
        await repo.delete(shiftIds);
        // Return the success message
        return {
          type: action.type,
          success: true,
          message: `Deleted ${shiftIds.length} shifts`,
        };
      }

      // Build filter from optional params
      const where: Record<string, unknown> = { scheduleId };
      if (date) where.date = date;
      if (period) where.period = period;
      if (role) where.role = role;

      if (Object.keys(where).length === 1) {
        // Return the error message
        return {
          type: action.type,
          success: false,
          message:
            "Must provide at least one filter (shiftIds, date, period, or role)",
        };
      }

      // Find the shifts
      const shifts = await repo.find({ where });

      // Check if there are any shifts
      if (shifts.length === 0) {
        return {
          type: action.type,
          success: true,
          message: "No shifts matched the filter",
        };
      }

      // Delete the shifts
      await repo.remove(shifts);
      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Deleted ${shifts.length} shifts`,
      };
    }
    case "assign_employee": {
      const { shiftId, employeeId } = action as {
        type: string;
        shiftId: number;
        employeeId: number;
      };

      // Check if the shift ID or employee ID is valid
      if (!shiftId || !employeeId) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftId or employeeId",
        };
      }

      // Get the shift and employee repositories
      const shiftRepo = AppDataSource.getRepository(Shift);
      const empRepo = AppDataSource.getRepository(Employee);

      // Find the shift
      const shift = await shiftRepo.findOne({ where: { id: shiftId } });
      if (!shift) {
        return {
          type: action.type,
          success: false,
          message: `Shift ${shiftId} not found`,
        };
      }

      // Find the employee
      const employee = await empRepo.findOne({ where: { id: employeeId } });
      if (!employee) {
        return {
          type: action.type,
          success: false,
          message: `Employee ${employeeId} not found`,
        };
      }

      // Assign the employee to the shift
      shift.assignedEmployeeId = employeeId;
      shift.assignedEmployee = employee;
      await shiftRepo.save(shift);

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Assigned ${employee.name} to ${shift.date} ${shift.period} (${shift.role})`,
      };
    }
    case "unassign_employee": {
      const { shiftIds } = action as { type: string; shiftIds: number[] };

      // Check if the shift IDs are valid
      if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
        return {
          type: action.type,
          success: false,
          message: "Missing or empty shiftIds array",
        };
      }

      // Get the shift repository
      const repo = AppDataSource.getRepository(Shift);
      let unassigned = 0;

      // Iterate through the shift IDs
      for (const id of shiftIds) {
        // Find the shift
        const shift = await repo.findOne({ where: { id } });
        if (shift && shift.assignedEmployeeId) {
          // Unassign the employee from the shift
          shift.assignedEmployeeId = null;
          shift.assignedEmployee = null;
          await repo.save(shift);

          // Count the number of unassigned shifts
          unassigned++;
        }
      }

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Unassigned ${unassigned} of ${shiftIds.length} shifts`,
      };
    }
    default:
      // Return the error message
      return {
        type: action.type,
        success: false,
        message: `Unknown action: ${action.type}`,
      };
  }
}

/**
 * Main chat handler. Sends the user message (with conversation history and
 * current scheduling context) to OpenAI using native tool calling.
 * Runs a loop: if the model returns tool_calls, executes them and feeds
 * results back until the model produces a final text response.
 */
export async function handleChatMessage(
  message: string,
  history: { role: string; content: string }[],
  scheduleId: number
): Promise<{
  reply: string;
  actions: { type: string; success: boolean; message: string }[];
}> {
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
      temperature: 0.3,
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
        } catch {
          // Non-critical — don't fail the response
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

      // Parse the arguments from the tool call
      const args = JSON.parse(toolCall.function.arguments);
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
    } catch {
      // Non-critical
    }
  }

  return {
    reply: "I completed the requested actions.",
    actions: actionResults,
  };
}
