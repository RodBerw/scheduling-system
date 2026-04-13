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
import { Between } from "typeorm";

/** Each shift counts as 4 hours toward an employee's weekly limit */
const HOURS_PER_SHIFT = 4;
const PERIODS: Period[] = ["morning", "afternoon", "evening"];

/** Calculates the Monday–Sunday boundaries of the week containing the given date. */
function getWeekBounds(dateStr: string): {
  weekStart: string;
  weekEnd: string;
} {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().split("T")[0],
    weekEnd: sunday.toISOString().split("T")[0],
  };
}

/** Returns an array of all dates (YYYY-MM-DD) between startDate and endDate inclusive. */
function eachDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Counts how many hours an employee has been assigned within a given week range. */
function countAssignedHours(
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
  const shiftRepo = AppDataSource.getRepository(Shift);
  const employeeRepo = AppDataSource.getRepository(Employee);
  const requirementRepo = AppDataSource.getRepository(ScheduleRequirement);
  const scheduleRepo = AppDataSource.getRepository(Schedule);

  // Get the schedule
  const schedule = await scheduleRepo.findOneOrFail({
    where: { id: scheduleId },
  });
  const { startDate, endDate } = schedule;

  // Clear previous shifts for this schedule before regenerating
  await shiftRepo.delete({ scheduleId });

  // Get the employees and requirements
  const employees = await employeeRepo.find();
  const requirements = await requirementRepo.find({ where: { scheduleId } });

  if (requirements.length === 0) {
    throw new Error(
      "No requirements defined for this schedule. Please set requirements first."
    );
  }

  const allShifts: Shift[] = [];

  // Iterate through each date in the schedule range
  for (const date of eachDate(startDate, endDate)) {
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
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
        const eligible = employees
          .filter((employee) => {
            if (employee.role !== requirement.role) return false;

            const availability: number[] = JSON.parse(employee.availability);

            if (!availability.includes(dayOfWeek)) return false;

            // Count the hours assigned to the employee this week
            const hours = countAssignedHours(
              weekShifts,
              employee.id,
              weekStart,
              weekEnd
            );

            if (hours + HOURS_PER_SHIFT > employee.maxHoursPerWeek)
              return false;

            const alreadyAssigned = allShifts.some(
              (s) =>
                s.date === date &&
                s.period === period &&
                s.assignedEmployeeId === employee.id
            );
            if (alreadyAssigned) return false;
            return true;
          })
          .sort((a, b) => {
            // Greedy: prefer the employee with the fewest assigned hours this week
            const hoursA = countAssignedHours(
              weekShifts,
              a.id,
              weekStart,
              weekEnd
            );
            const hoursB = countAssignedHours(
              weekShifts,
              b.id,
              weekStart,
              weekEnd
            );
            return hoursA - hoursB;
          });

        // Create one shift per required count; assign if an eligible employee exists
        for (let i = 0; i < requirement.requiredCount; i++) {
          const employee = eligible[i] || null;

          // Create a new shift
          const shift = shiftRepo.create({
            date,
            period,
            role: requirement.role,
            assignedEmployeeId: employee?.id ?? null,
            assignedEmployee: employee,
            scheduleId,
            explanation: employee
              ? `${employee.name} assigned — fewest hours this week among available ${requirement.role}s`
              : `Unfilled — no eligible ${requirement.role} available for ${period}`,
          });
          allShifts.push(shift);
        }
      }
    }
  }

  const saved = await shiftRepo.save(allShifts);

  // Return the saved shifts
  return saved;
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
  const employeeRepo = AppDataSource.getRepository(Employee);

  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
  const previousId = shift.assignedEmployeeId;

  // Create a list of employees to exclude
  const toExclude = [...excludeEmployeeIds];
  if (previousId) toExclude.push(previousId);

  // Get the week bounds
  const { weekStart, weekEnd } = getWeekBounds(shift.date);
  const weekShifts = await shiftRepo.find({
    where: { date: Between(weekStart, weekEnd) },
  });

  // Get the day of the week
  const dayOfWeek = new Date(shift.date + "T00:00:00").getDay();
  const employees = await employeeRepo.find();

  // Filter eligible replacements: matching role, not excluded, available, under hour limit,
  // and not already working this same date+period
  const eligible = employees
    .filter((emp) => {
      if (emp.role !== shift.role) return false;
      if (toExclude.includes(emp.id)) return false;
      const availability: number[] = JSON.parse(emp.availability);
      if (!availability.includes(dayOfWeek)) return false;
      const hours = countAssignedHours(weekShifts, emp.id, weekStart, weekEnd);
      if (hours + HOURS_PER_SHIFT > emp.maxHoursPerWeek) return false;
      const alreadyAssigned = weekShifts.some(
        (s) =>
          s.id !== shiftId &&
          s.date === shift.date &&
          s.period === shift.period &&
          s.assignedEmployeeId === emp.id
      );
      if (alreadyAssigned) return false;
      return true;
    })
    .sort((a, b) => {
      const hoursA = countAssignedHours(weekShifts, a.id, weekStart, weekEnd);
      const hoursB = countAssignedHours(weekShifts, b.id, weekStart, weekEnd);
      return hoursA - hoursB;
    });

  const replacement = eligible[0] || null;
  shift.assignedEmployeeId = replacement?.id ?? null;
  shift.assignedEmployee = replacement;
  shift.explanation = replacement
    ? `${replacement.name} replaced previous employee — fewest hours among eligible ${shift.role}s`
    : `Unfilled — no eligible replacement ${shift.role} available`;

  return shiftRepo.save(shift);
}
