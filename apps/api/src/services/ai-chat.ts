/**
 * AI Chat service.
 * Integrates with OpenAI to provide an intelligent scheduling assistant.
 * The assistant can understand natural language requests and execute scheduling actions
 * (set requirements, generate schedules, replace employees) via structured action blocks
 * embedded in the model's response.
 */
import OpenAI from "openai";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift } from "../entities/Shift";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { generateSchedule, replaceEmployee } from "./scheduler";

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
              `  [ShiftID:${s.id}] ${s.date} ${s.period} — ${s.role}: ${
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
 * System prompt that instructs the AI model on its role, available actions,
 * and the JSON action block format it should use to trigger scheduling operations.
 */
const SYSTEM_PROMPT = `You are a restaurant scheduling assistant. You help managers set up staffing requirements and generate schedules.

You can perform actions by including JSON blocks in your response. When you need to execute an action, include it in this exact format:

\`\`\`action
{"type": "set_requirements", "requirements": [{"dayOfWeek": 0, "role": "cook", "period": "morning", "requiredCount": 2}, ...]}
\`\`\`

\`\`\`action
{"type": "generate_schedule"}
\`\`\`

\`\`\`action
{"type": "replace_employee", "shiftId": 123}
\`\`\`

IMPORTANT RULES FOR REQUIREMENTS:
- dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- roles: "cook", "waiter", "dishwasher", "manager"
- periods: "morning", "afternoon", "evening"
- When setting requirements, include ALL requirements (the action replaces all existing ones)
- If the user says "weekdays", that means Monday(1) through Friday(5)
- If the user says "weekends", that means Saturday(6) and Sunday(0)
- If requirements already exist and the user wants to add or modify some, merge with existing ones
- Be smart about typical restaurant needs — if the user says "3 cooks on weekday evenings", generate requirements for Mon-Fri evenings with 3 cooks, but KEEP existing requirements for other slots

RULES:
- generate_schedule requires requirements to be set first. If none exist, set them first.
- When replacing, find the correct shift ID from the context.
- If a replacement request matches multiple shifts (e.g. "replace Camila on Friday" and she has both an afternoon and evening shift), replace ALL matching shifts. Include one action block per shift. Do NOT ask the user to confirm or choose — just execute all replacements.
- Always be helpful and explain what you did.
- Use the employee names and shift IDs from the CONTEXT.
- ALWAYS include action blocks when performing operations. Never respond with just information when the user is clearly requesting an action — investigate the context and execute.`;

interface ParsedAction {
  type: string;
  [key: string]: unknown;
}

/** Extracts JSON action blocks from the model's raw text response. */
function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const regex = /```action\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1].trim()));
    } catch (err) {
      console.warn("Failed to parse AI action block:", match[1].trim(), err);
    }
  }
  return actions;
}

/** Removes action blocks from the model's response to produce clean user-facing text. */
function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*\n[\s\S]*?```/g, "").trim();
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

      if (!requirements || !Array.isArray(requirements)) {
        return {
          type: action.type,
          success: false,
          message: "Invalid requirements format",
        };
      }

      // Delete existing requirements
      const repo = AppDataSource.getRepository(ScheduleRequirement);
      await repo.delete({ scheduleId });

      // Set new requirements
      const entities = requirements.map((r) =>
        repo.create({ ...r, scheduleId } as Partial<ScheduleRequirement>)
      );
      const saved = await repo.save(entities);
      return {
        type: action.type,
        success: true,
        message: `Set ${saved.length} staffing requirements`,
      };
    }
    case "generate_schedule": {
      try {
        const shifts = await generateSchedule(scheduleId);
        const filled = shifts.filter((s) => s.assignedEmployeeId).length;
        const unfilled = shifts.length - filled;
        return {
          type: action.type,
          success: true,
          message: `Generated ${shifts.length} shifts (${filled} filled, ${unfilled} unfilled)`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        return { type: action.type, success: false, message: msg };
      }
    }
    case "replace_employee": {
      const { shiftId } = action as { shiftId: number; type: string };
      if (!shiftId) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftId",
        };
      }
      const shift = await replaceEmployee(shiftId);
      return {
        type: action.type,
        success: true,
        message: shift.assignedEmployee
          ? `Replaced with ${shift.assignedEmployee.name} on ${shift.date} ${shift.period}`
          : `Could not find a replacement for ${shift.role} on ${shift.date} ${shift.period}`,
      };
    }
    default:
      return {
        type: action.type,
        success: false,
        message: `Unknown action: ${action.type}`,
      };
  }
}

/**
 * Main chat handler. Sends the user message (with conversation history and
 * current scheduling context) to OpenAI, parses any action blocks from
 * the response, executes them, and returns the cleaned reply along with action results.
 */
export async function handleChatMessage(
  message: string,
  history: { role: string; content: string }[],
  scheduleId: number
): Promise<{
  reply: string;
  actions: { type: string; success: boolean; message: string }[];
}> {
  const context = await buildContext(scheduleId);

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
        }) as OpenAI.ChatCompletionMessageParam
    ),
    { role: "user", content: message },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.3,
  });

  const rawReply =
    completion.choices[0]?.message?.content ||
    "Sorry, I couldn't process that.";

  // Parse and execute any action blocks embedded in the model's response
  const parsedActions = parseActions(rawReply);
  const actionResults: { type: string; success: boolean; message: string }[] =
    [];

  for (const action of parsedActions) {
    const result = await executeAction(action, scheduleId);
    actionResults.push(result);
  }

  // Strip action blocks from the reply and append execution results
  let reply = stripActionBlocks(rawReply);
  if (actionResults.length > 0) {
    const resultText = actionResults
      .map((r) => (r.success ? `Done: ${r.message}` : `Failed: ${r.message}`))
      .join("\n");
    reply = reply ? `${reply}\n\n${resultText}` : resultText;
  }

  return { reply, actions: actionResults };
}
