import OpenAI from "openai";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift } from "../entities/Shift";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { generateSchedule, replaceEmployee } from "./scheduler";
import { Between } from "typeorm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Please configure it in apps/api/.env");
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

async function buildContext(): Promise<string> {
  const employees = await AppDataSource.getRepository(Employee).find();
  const { start, end } = getCurrentWeekRange();
  const shifts = await AppDataSource.getRepository(Shift).find({
    where: { date: Between(start, end) },
    order: { date: "ASC", period: "ASC" },
  });
  const requirements = await AppDataSource.getRepository(ScheduleRequirement).find();

  const empList = employees
    .map((e) => `  [ID:${e.id}] ${e.name} (${e.role}, ${e.maxHoursPerWeek}h/wk, available: ${JSON.parse(e.availability).map((d: number) => DAYS[d]).join(", ")})`)
    .join("\n");

  const shiftSummary = shifts.length > 0
    ? shifts
        .map((s) => `  [ShiftID:${s.id}] ${s.date} ${s.period} — ${s.role}: ${s.assignedEmployee?.name || "UNFILLED"}`)
        .join("\n")
    : "  No shifts scheduled yet.";

  const reqSummary = [...new Set(requirements.map((r) => r.dayOfWeek))]
    .sort()
    .map((day) => {
      const dayReqs = requirements.filter((r) => r.dayOfWeek === day);
      const details = dayReqs.map((r) => `${r.period}: ${r.requiredCount} ${r.role}s`).join(", ");
      return `  ${DAYS[day]}: ${details}`;
    })
    .join("\n");

  return `
CURRENT DATE: ${new Date().toISOString().split("T")[0]}
CURRENT WEEK: ${start} to ${end}

EMPLOYEES (${employees.length} total):
${empList}

SCHEDULE REQUIREMENTS:
${reqSummary}

CURRENT WEEK SHIFTS (${shifts.length} total):
${shiftSummary}
`.trim();
}

const SYSTEM_PROMPT = `You are a restaurant scheduling assistant. You help managers manage their weekly staff schedule.

You can perform actions by including JSON blocks in your response. When you need to execute an action, include it in this exact format:

\`\`\`action
{"type": "generate_schedule", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}
\`\`\`

\`\`\`action
{"type": "replace_employee", "shiftId": 123}
\`\`\`

RULES:
- When the user asks to generate a schedule, determine the correct date range and include the action.
- "This week" means the current week (Monday to Sunday based on CURRENT DATE in context).
- "Next week" means the following week.
- "Weekend" means Friday to Sunday.
- When replacing, find the correct shift ID from the context and include the replace action.
- Always be helpful and explain what you did.
- If you can't find a matching employee or shift, explain why.
- Use the employee names and shift IDs from the CONTEXT below.
- You can include multiple actions in one response if needed.
- ALWAYS include the action block when performing an operation — never just describe what you would do.`;

interface ParsedAction {
  type: string;
  [key: string]: unknown;
}

function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const regex = /```action\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1].trim()));
    } catch {
      // Skip malformed action blocks
    }
  }
  return actions;
}

function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*\n[\s\S]*?```/g, "").trim();
}

async function executeAction(action: ParsedAction): Promise<{ type: string; success: boolean; message: string }> {
  switch (action.type) {
    case "generate_schedule": {
      const { startDate, endDate } = action as { startDate: string; endDate: string; type: string };
      if (!startDate || !endDate) {
        return { type: action.type, success: false, message: "Missing startDate or endDate" };
      }
      const shifts = await generateSchedule(startDate, endDate);
      const filled = shifts.filter((s) => s.assignedEmployeeId).length;
      const unfilled = shifts.length - filled;
      return {
        type: action.type,
        success: true,
        message: `Generated ${shifts.length} shifts (${filled} filled, ${unfilled} unfilled) from ${startDate} to ${endDate}`,
      };
    }
    case "replace_employee": {
      const { shiftId } = action as { shiftId: number; type: string };
      if (!shiftId) {
        return { type: action.type, success: false, message: "Missing shiftId" };
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
      return { type: action.type, success: false, message: `Unknown action: ${action.type}` };
  }
}

export async function handleChatMessage(
  message: string,
  history: { role: string; content: string }[],
): Promise<{ reply: string; actions: { type: string; success: boolean; message: string }[] }> {
  const context = await buildContext();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nCONTEXT:\n${context}` },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
  });

  const rawReply = completion.choices[0]?.message?.content || "Sorry, I couldn't process that.";

  // Parse and execute actions
  const parsedActions = parseActions(rawReply);
  const actionResults: { type: string; success: boolean; message: string }[] = [];

  for (const action of parsedActions) {
    const result = await executeAction(action);
    actionResults.push(result);
  }

  // Build clean reply
  let reply = stripActionBlocks(rawReply);
  if (actionResults.length > 0) {
    const resultText = actionResults
      .map((r) => (r.success ? `✓ ${r.message}` : `✗ ${r.message}`))
      .join("\n");
    reply = reply ? `${reply}\n\n${resultText}` : resultText;
  }

  return { reply, actions: actionResults };
}
