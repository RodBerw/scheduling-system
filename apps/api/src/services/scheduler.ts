/**
 * Scheduler service.
 * Implements the core scheduling algorithm that auto-generates shifts
 * based on staffing requirements and assigns employees using a greedy
 * strategy that prioritizes workers with the fewest hours in the current week.
 */
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift, Period } from "../entities/Shift";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { Between, EntityManager } from "typeorm";

/** Each shift counts as 4 hours toward an employee's weekly limit */
const HOURS_PER_SHIFT = 4;
const PERIODS: Period[] = ["morning", "afternoon", "evening"];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Calculates the Monday–Sunday boundaries of the week containing the given date. */
export function getWeekBounds(dateStr: string): { weekStart: string; weekEnd: string } {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0],
  };
}

/** Returns an array of all dates (YYYY-MM-DD) between startDate and endDate inclusive. */
export function eachDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Employee eligibility helpers
// ---------------------------------------------------------------------------

/** Counts how many hours an employee has been assigned within a given week range. */
export function countWeeklyHours(
  shifts: Shift[],
  employeeId: number,
  weekStart: string,
  weekEnd: string
): number {
  return (
    shifts.filter(
      (s) =>
        s.assignedEmployeeId === employeeId &&
        s.date >= weekStart &&
        s.date <= weekEnd
    ).length * HOURS_PER_SHIFT
  );
}

/** Safely parses an employee's availability JSON. Returns null on failure. */
function parseAvailability(employee: Employee): number[] | null {
  try {
    return JSON.parse(employee.availability);
  } catch {
    console.warn(
      `Invalid availability JSON for employee ${employee.id} (${employee.name})`
    );
    return null;
  }
}

/**
 * Finds eligible employees for a shift slot, sorted by fewest weekly hours (greedy).
 *
 * Filters by: matching role, day-of-week availability, weekly hour limit,
 * not already assigned to the same date+period, and not in the exclude list.
 */
export function findEligibleEmployees(
  employees: Employee[],
  allShifts: Shift[],
  opts: {
    role: string;
    date: string;
    period: string;
    weekStart: string;
    weekEnd: string;
    excludeIds?: number[];
    excludeShiftId?: number;
  }
): Employee[] {
  const dayOfWeek = new Date(opts.date + "T00:00:00Z").getUTCDay();
  const excludeIds = opts.excludeIds ?? [];

  return employees
    .filter((emp) => {
      if (emp.role !== opts.role) return false;
      if (excludeIds.includes(emp.id)) return false;

      const availability = parseAvailability(emp);
      if (!availability || !availability.includes(dayOfWeek)) return false;

      // Check weekly hour limit
      const hours = countWeeklyHours(allShifts, emp.id, opts.weekStart, opts.weekEnd);
      if (hours + HOURS_PER_SHIFT > emp.maxHoursPerWeek) return false;

      // Check if the employee is already assigned to this date+period
      const alreadyAssigned = allShifts.some(
        (s) =>
          s.id !== opts.excludeShiftId &&
          s.date === opts.date &&
          s.period === opts.period &&
          s.assignedEmployeeId === emp.id
      );
      if (alreadyAssigned) return false;

      return true;
    })
    .sort((a, b) => {
      // Greedy: prefer the employee with the fewest assigned hours this week
      const hoursA = countWeeklyHours(allShifts, a.id, opts.weekStart, opts.weekEnd);
      const hoursB = countWeeklyHours(allShifts, b.id, opts.weekStart, opts.weekEnd);
      return hoursA - hoursB;
    });
}

// ---------------------------------------------------------------------------
// Shift creation helper
// ---------------------------------------------------------------------------

/** Creates a shift entity with an explanation of why the employee was (or wasn't) assigned. */
function buildShift(
  shiftRepo: ReturnType<EntityManager["getRepository"]>,
  params: {
    date: string;
    period: string;
    role: string;
    scheduleId: number;
    employee: Employee | null;
  }
): Shift {
  const { date, period, role, scheduleId, employee } = params;
  return shiftRepo.create({
    date,
    period,
    role,
    assignedEmployeeId: employee?.id ?? null,
    assignedEmployee: employee,
    scheduleId,
    explanation: employee
      ? `${employee.name} assigned — fewest hours this week among available ${role}s`
      : `Unfilled — no eligible ${role} available for ${period}`,
  }) as Shift;
}

// ---------------------------------------------------------------------------
// Generation lock
// ---------------------------------------------------------------------------

/** Lock to prevent concurrent schedule generation for the same schedule */
const generationLocks = new Set<number>();

/** Acquires a per-schedule lock, runs the callback, then releases. */
async function withGenerationLock<T>(
  scheduleId: number,
  fn: () => Promise<T>
): Promise<T> {
  if (generationLocks.has(scheduleId)) {
    throw new Error(
      "Schedule generation already in progress for this schedule."
    );
  }
  generationLocks.add(scheduleId);
  try {
    return await fn();
  } finally {
    generationLocks.delete(scheduleId);
  }
}

// ---------------------------------------------------------------------------
// Shared data loading
// ---------------------------------------------------------------------------

/** Loads the schedule, employees, and requirements for a given schedule ID. */
async function loadScheduleData(manager: EntityManager, scheduleId: number) {
  const scheduleRepo = manager.getRepository(Schedule);
  const employeeRepo = manager.getRepository(Employee);
  const requirementRepo = manager.getRepository(ScheduleRequirement);

  const schedule = await scheduleRepo.findOneOrFail({
    where: { id: scheduleId },
  });

  const employees = await employeeRepo.find();
  const requirements = await requirementRepo.find({
    where: { scheduleId },
  });

  if (requirements.length === 0) {
    throw new Error(
      "No requirements defined for this schedule. Please set requirements first."
    );
  }

  return { schedule, employees, requirements };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates all shifts for a schedule based on its defined requirements.
 *
 * Algorithm:
 * 1. Iterates through each date in the schedule range.
 * 2. For each date+period, looks up the staffing requirements.
 * 3. Filters eligible employees by role, availability, and weekly hour limit.
 * 4. Assigns the employee with the fewest hours worked that week (greedy balancing).
 * 5. Creates unfilled shifts when no eligible employee is available.
 *
 * Existing shifts for the schedule are deleted before regeneration.
 */
export async function generateSchedule(scheduleId: number): Promise<Shift[]> {
  return withGenerationLock(scheduleId, () =>
    AppDataSource.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(Shift);
      const { schedule, employees, requirements } = await loadScheduleData(manager, scheduleId);
      const { startDate, endDate } = schedule;

      // Clear previous shifts for this schedule before regenerating
      await shiftRepo.delete({ scheduleId });

      const allShifts: Shift[] = [];

      // Iterate through each date in the schedule range
      for (const date of eachDate(startDate, endDate)) {
        const dayOfWeek = new Date(date + "T00:00:00Z").getUTCDay();
        const { weekStart, weekEnd } = getWeekBounds(date);

        // Include shifts from other schedules in the same week for accurate hour counting
        const existingWeekShifts = await shiftRepo.find({
          where: { date: Between(weekStart, weekEnd) },
        });
        const weekShifts = [...existingWeekShifts, ...allShifts];

        // Iterate through each period
        for (const period of PERIODS) {
          // Get the requirements for the current day and period
          const dayRequirements = requirements.filter(
            (r) => r.dayOfWeek === dayOfWeek && r.period === period
          );

          for (const requirement of dayRequirements) {
            // Filter and sort eligible employees: matching role, available on this day,
            // under weekly hour limit, and not already assigned to this date+period
            const eligible = findEligibleEmployees(employees, weekShifts, {
              role: requirement.role,
              date,
              period,
              weekStart,
              weekEnd,
            });

            // Create one shift per required count; assign if an eligible employee exists
            for (let i = 0; i < requirement.requiredCount; i++) {
              allShifts.push(
                buildShift(shiftRepo, {
                  date,
                  period,
                  role: requirement.role,
                  scheduleId,
                  employee: eligible[i] || null,
                })
              );
            }
          }
        }
      }

      return shiftRepo.save(allShifts);
    })
  );
}

/**
 * Incrementally fills shifts based on requirements WITHOUT deleting existing ones.
 * Only creates shifts for slots that don't already have enough shifts.
 * Preserves all manual assignments and existing shifts.
 */
export async function fillNewShifts(
  scheduleId: number
): Promise<{ added: number; filled: number; unfilled: number; kept: number }> {
  return withGenerationLock(scheduleId, () =>
    AppDataSource.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(Shift);
      const { schedule, employees, requirements } = await loadScheduleData(manager, scheduleId);
      const { startDate, endDate } = schedule;

      // Load existing shifts for this schedule
      const existingShifts = await shiftRepo.find({
        where: { scheduleId },
        relations: ["assignedEmployee"],
      });

      const newShifts: Shift[] = [];
      const kept = existingShifts.length;

      // Iterate through each date in the schedule range
      for (const date of eachDate(startDate, endDate)) {
        const dayOfWeek = new Date(date + "T00:00:00Z").getUTCDay();
        const { weekStart, weekEnd } = getWeekBounds(date);

        // Get the existing shifts for the week
        const existingWeekShifts = await shiftRepo.find({
          where: { date: Between(weekStart, weekEnd) },
        });
        // Combine the existing shifts with the new shifts
        const allShifts = [...existingWeekShifts, ...newShifts];

        // Iterate through each period
        for (const period of PERIODS) {
          // Get the requirements for the current day and period
          const dayRequirements = requirements.filter(
            (r) => r.dayOfWeek === dayOfWeek && r.period === period
          );

          // Iterate through each requirement
          for (const requirement of dayRequirements) {
            // Count how many shifts already exist for this slot
            const existingForSlot = existingShifts.filter(
              (s) =>
                s.date === date &&
                s.period === period &&
                s.role === requirement.role
            );

            // Only create shifts for the gap
            const needed = requirement.requiredCount - existingForSlot.length;
            if (needed <= 0) continue;

            // Find eligible employees (same logic as generateSchedule)
            const eligible = findEligibleEmployees(employees, [...existingShifts, ...newShifts, ...allShifts], {
              role: requirement.role,
              date,
              period,
              weekStart,
              weekEnd,
            });

            // Create the shifts
            for (let i = 0; i < needed; i++) {
              newShifts.push(
                buildShift(shiftRepo, {
                  date,
                  period,
                  role: requirement.role,
                  scheduleId,
                  employee: eligible[i] || null,
                })
              );
            }
          }
        }
      }

      // Save the new shifts
      const saved = await shiftRepo.save(newShifts);
      // Count the number of filled shifts
      const filled = saved.filter((s) => s.assignedEmployeeId).length;

      return {
        added: saved.length,
        filled,
        unfilled: saved.length - filled,
        kept,
      };
    })
  );
}

/**
 * Finds a replacement employee for an existing shift.
 * Excludes the currently assigned employee (and any explicitly excluded IDs),
 * then picks the eligible employee with the fewest weekly hours.
 */
export async function replaceEmployee(
  shiftId: number,
  excludeEmployeeIds: number[] = []
): Promise<Shift> {
  const shiftRepo = AppDataSource.getRepository(Shift);

  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
  const previousId = shift.assignedEmployeeId;

  // Create a list of employees to exclude
  const excludeIds = [...excludeEmployeeIds];
  if (previousId) excludeIds.push(previousId);

  // Get the week bounds
  const { weekStart, weekEnd } = getWeekBounds(shift.date);
  const weekShifts = await shiftRepo.find({
    where: { date: Between(weekStart, weekEnd) },
  });

  const employees = await AppDataSource.getRepository(Employee).find();

  // Filter eligible replacements: matching role, not excluded, available, under hour limit,
  // and not already working this same date+period
  const eligible = findEligibleEmployees(employees, weekShifts, {
    role: shift.role,
    date: shift.date,
    period: shift.period,
    weekStart,
    weekEnd,
    excludeIds,
    excludeShiftId: shiftId,
  });

  // Get the replacement employee (the first eligible employee)
  const replacement = eligible[0] || null;

  // Assign the replacement employee to the shift
  shift.assignedEmployeeId = replacement?.id ?? null;
  shift.assignedEmployee = replacement;

  // Set the explanation for the shift
  shift.explanation = replacement
    ? `${replacement.name} replaced previous employee — fewest hours among eligible ${shift.role}s`
    : `Unfilled — no eligible replacement ${shift.role} available`;

  // Save the shift
  return shiftRepo.save(shift);
}

/**
 * Replaces the assigned employee on multiple shifts at once.
 * For each shift, attempts to find an eligible replacement; if none is found
 * the shift becomes unfilled.
 */
export async function replaceEmployeeBatch(
  shiftIds: number[]
): Promise<Shift[]> {
  const results: Shift[] = [];
  for (const shiftId of shiftIds) {
    const shift = await replaceEmployee(shiftId);
    results.push(shift);
  }
  return results;
}
