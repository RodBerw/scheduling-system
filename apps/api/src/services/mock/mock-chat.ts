/**
 * Mock chat fallback — used when no OpenAI API key is configured.
 * Uses simple keyword matching to detect intent, then runs the same
 * executeAction pipeline as the real AI chat to modify the database.
 */
import { AppDataSource } from "../../data-source";
import { Employee } from "../../entities/Employee";
import { Shift } from "../../entities/Shift";
import { ScheduleRequirement } from "../../entities/ScheduleRequirement";
import { fillNewShifts, generateSchedule } from "../scheduler";
import { executeAction, type ParsedAction } from "../action-executor";

// ---------------------------------------------------------------------------
// Keyword maps
// ---------------------------------------------------------------------------

const DAY_KEYWORDS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDays(text: string): number[] {
  if (/weekday/.test(text)) return [1, 2, 3, 4, 5];
  if (/weekend/.test(text)) return [0, 6];
  if (/every\s*day|all\s*days/.test(text)) return [0, 1, 2, 3, 4, 5, 6];
  const days: number[] = [];
  for (const [name, num] of Object.entries(DAY_KEYWORDS)) {
    if (text.includes(name)) days.push(num);
  }
  return days;
}

function findEmployee(lower: string, employees: Employee[]): Employee | undefined {
  return employees.find((e) => lower.includes(e.name.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Intent detection → actions
// ---------------------------------------------------------------------------

function detectActions(
  lower: string,
  shifts: Shift[],
  employees: Employee[],
): { actions: ParsedAction[]; reply: string } | null {

  // 1) Generate / regenerate
  if (/\b(generate|regenerate|rebuild)\b/.test(lower)) {
    return {
      actions: [{ type: "generate_schedule" }],
      reply: "Generating the schedule from current requirements.",
    };
  }

  // 2) Set requirements — "3 cooks on monday morning"
  const reqPattern = /(\d+)\s+(cook|waiter|dishwasher|manager)s?\s+(?:on\s+|for\s+)?(.+?)\s+(morning|afternoon|evening)/gi;
  const reqActions: ParsedAction[] = [];
  let m: RegExpExecArray | null;
  while ((m = reqPattern.exec(lower)) !== null) {
    const days = parseDays(m[3].trim());
    if (days.length > 0) {
      reqActions.push({
        type: "set_requirements",
        requirements: days.map((d) => ({
          dayOfWeek: d,
          role: m![2],
          period: m![4],
          requiredCount: parseInt(m![1], 10),
        })),
      });
    }
  }
  if (reqActions.length > 0) {
    return { actions: reqActions, reply: "Updated requirements." };
  }

  // 3) Replace employee
  if (/\breplace\b/.test(lower)) {
    const emp = findEmployee(lower, employees);
    if (emp) {
      const empShifts = shifts.filter((s) => s.assignedEmployeeId === emp.id);
      if (empShifts.length > 0) {
        return {
          actions: empShifts.length === 1
            ? [{ type: "replace_employee", shiftId: empShifts[0].id }]
            : [{ type: "replace_employee_batch", shiftIds: empShifts.map((s) => s.id) }],
          reply: `Replacing ${emp.name} on ${empShifts.length} shift(s).`,
        };
      }
    }
  }

  // 4) Swap two employees
  if (/\bswap\b/.test(lower)) {
    const found: { emp: Employee; shift: Shift }[] = [];
    for (const emp of employees) {
      if (lower.includes(emp.name.toLowerCase())) {
        const s = shifts.find((s) => s.assignedEmployeeId === emp.id);
        if (s) found.push({ emp, shift: s });
      }
    }
    if (found.length === 2) {
      return {
        actions: [{ type: "swap_employees", shiftIdA: found[0].shift.id, shiftIdB: found[1].shift.id }],
        reply: `Swapping ${found[0].emp.name} and ${found[1].emp.name}.`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auto-seed: populate an empty schedule with default requirements + shifts
// ---------------------------------------------------------------------------

const DEFAULT_REQS = {
  weekday: [
    { role: "manager", morning: 1, afternoon: 1, evening: 1 },
    { role: "cook", morning: 2, afternoon: 2, evening: 3 },
    { role: "waiter", morning: 2, afternoon: 3, evening: 3 },
    { role: "dishwasher", morning: 1, afternoon: 1, evening: 2 },
  ],
  weekend: [
    { role: "manager", morning: 1, afternoon: 1, evening: 1 },
    { role: "cook", morning: 2, afternoon: 3, evening: 4 },
    { role: "waiter", morning: 3, afternoon: 4, evening: 5 },
    { role: "dishwasher", morning: 1, afternoon: 2, evening: 2 },
  ],
} as const;

/**
 * If the schedule has no requirements, seeds it with defaults and generates shifts.
 * Returns action results describing what was created, or empty if already populated.
 */
async function autoSeedIfEmpty(
  scheduleId: number
): Promise<{ type: string; success: boolean; message: string }[]> {
  const reqRepo = AppDataSource.getRepository(ScheduleRequirement);
  const existing = await reqRepo.find({ where: { scheduleId } });
  if (existing.length > 0) return [];

  const results: { type: string; success: boolean; message: string }[] = [];

  // Create requirements for all 7 days
  const reqs: Partial<ScheduleRequirement>[] = [];
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const template = dayOfWeek === 0 || dayOfWeek === 6
      ? DEFAULT_REQS.weekend
      : DEFAULT_REQS.weekday;
    for (const req of template) {
      for (const period of ["morning", "afternoon", "evening"] as const) {
        reqs.push({
          dayOfWeek,
          role: req.role,
          period,
          requiredCount: req[period],
          scheduleId,
        });
      }
    }
  }
  await reqRepo.save(reqs.map((r) => reqRepo.create(r)));
  results.push({
    type: "auto_seed_requirements",
    success: true,
    message: `Created ${reqs.length} default staffing requirements`,
  });

  // Generate shifts
  try {
    const shifts = await generateSchedule(scheduleId);
    const filled = shifts.filter((s) => s.assignedEmployeeId).length;
    results.push({
      type: "auto_seed_shifts",
      success: true,
      message: `Generated ${shifts.length} shifts (${filled} filled, ${shifts.length - filled} unfilled)`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    results.push({ type: "auto_seed_shifts", success: false, message: msg });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public handler
// ---------------------------------------------------------------------------

const HELP_MSG =
  "Running in **mock mode** (no OpenAI key). Supported commands:\n\n" +
  '- *"Generate the schedule"*\n' +
  '- *"3 cooks on monday morning"*\n' +
  '- *"Replace [name]"*\n' +
  '- *"Swap [name] and [name]"*\n\n' +
  "Add `OPENAI_API_KEY` to `apps/api/.env` for full natural-language support.";

export async function handleMockChat(
  message: string,
  scheduleId: number
): Promise<{
  reply: string;
  actions: { type: string; success: boolean; message: string }[];
}> {
  // Auto-seed empty schedules with default requirements + shifts
  const seedResults = await autoSeedIfEmpty(scheduleId);

  const shifts = await AppDataSource.getRepository(Shift).find({
    where: { scheduleId },
    relations: ["assignedEmployee"],
  });
  const employees = await AppDataSource.getRepository(Employee).find();

  const parsed = detectActions(message.toLowerCase(), shifts, employees);

  if (!parsed) {
    if (seedResults.length > 0) {
      const filled = shifts.filter((s) => s.assignedEmployeeId).length;
      return {
        reply:
          `This schedule was empty, so I set up **default requirements** and generated **${shifts.length} shifts** (${filled} filled).\n\n` +
          "You can now try commands like:\n" +
          '- *"Replace [name]"*\n' +
          '- *"3 cooks on monday morning"*\n' +
          '- *"Regenerate the schedule"*\n\n' +
          "Running in **mock mode** — add `OPENAI_API_KEY` for full natural-language support.",
        actions: seedResults,
      };
    }
    return { reply: HELP_MSG, actions: [] };
  }

  const actionResults: { type: string; success: boolean; message: string }[] = [...seedResults];

  for (const action of parsed.actions) {
    actionResults.push(await executeAction(action, scheduleId));
  }

  // Auto-fill gaps after mutations
  if (actionResults.length > 0) {
    try {
      const fill = await fillNewShifts(scheduleId);
      if (fill.added > 0) {
        actionResults.push({
          type: "auto_fill",
          success: true,
          message: `Auto-filled ${fill.added} shifts (${fill.filled} assigned, ${fill.unfilled} unfilled)`,
        });
      }
    } catch {
      // Non-critical
    }
  }

  return { reply: parsed.reply, actions: actionResults };
}
