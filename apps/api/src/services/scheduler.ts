import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift, Period } from "../entities/Shift";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { Between } from "typeorm";

const HOURS_PER_SHIFT = 4;
const PERIODS: Period[] = ["morning", "afternoon", "evening"];

function getWeekBounds(dateStr: string): { weekStart: string; weekEnd: string } {
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

function countAssignedHours(
  shifts: Shift[],
  employeeId: number,
  weekStart: string,
  weekEnd: string,
): number {
  return shifts.filter(
    (s) =>
      s.assignedEmployeeId === employeeId &&
      s.date >= weekStart &&
      s.date <= weekEnd,
  ).length * HOURS_PER_SHIFT;
}

export async function generateSchedule(
  startDate: string,
  endDate: string,
): Promise<Shift[]> {
  const shiftRepo = AppDataSource.getRepository(Shift);
  const employeeRepo = AppDataSource.getRepository(Employee);
  const reqRepo = AppDataSource.getRepository(ScheduleRequirement);

  // Delete existing shifts in range
  await shiftRepo
    .createQueryBuilder()
    .delete()
    .where("date >= :startDate AND date <= :endDate", { startDate, endDate })
    .execute();

  const employees = await employeeRepo.find();
  const requirements = await reqRepo.find();
  const allShifts: Shift[] = [];

  for (const date of eachDate(startDate, endDate)) {
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    const { weekStart, weekEnd } = getWeekBounds(date);

    // Get existing shifts in this week (outside range) for hour counting
    const existingWeekShifts = await shiftRepo.find({
      where: [
        { date: Between(weekStart, startDate < weekStart ? weekStart : startDate) },
        { date: Between(endDate < weekEnd ? endDate : weekEnd, weekEnd) },
      ],
    });
    const weekShifts = [...existingWeekShifts, ...allShifts];

    for (const period of PERIODS) {
      const dayRequirements = requirements.filter(
        (r) => r.dayOfWeek === dayOfWeek && r.period === period,
      );

      for (const req of dayRequirements) {
        const eligible = employees
          .filter((emp) => {
            if (emp.role !== req.role) return false;
            const availability: number[] = JSON.parse(emp.availability);
            if (!availability.includes(dayOfWeek)) return false;
            const hours = countAssignedHours(weekShifts, emp.id, weekStart, weekEnd);
            if (hours + HOURS_PER_SHIFT > emp.maxHoursPerWeek) return false;
            // Not already assigned to this date+period
            const alreadyAssigned = allShifts.some(
              (s) => s.date === date && s.period === period && s.assignedEmployeeId === emp.id,
            );
            if (alreadyAssigned) return false;
            return true;
          })
          .sort((a, b) => {
            const hoursA = countAssignedHours(weekShifts, a.id, weekStart, weekEnd);
            const hoursB = countAssignedHours(weekShifts, b.id, weekStart, weekEnd);
            return hoursA - hoursB;
          });

        for (let i = 0; i < req.requiredCount; i++) {
          const emp = eligible[i] || null;
          const shift = shiftRepo.create({
            date,
            period,
            role: req.role,
            assignedEmployeeId: emp?.id ?? null,
            assignedEmployee: emp,
            explanation: emp
              ? `${emp.name} assigned — fewest hours this week among available ${req.role}s`
              : `Unfilled — no eligible ${req.role} available for ${period}`,
          });
          allShifts.push(shift);
        }
      }
    }
  }

  // Save all at once
  const saved = await shiftRepo.save(allShifts);
  return saved;
}

export async function replaceEmployee(
  shiftId: number,
  excludeEmployeeIds: number[] = [],
): Promise<Shift> {
  const shiftRepo = AppDataSource.getRepository(Shift);
  const employeeRepo = AppDataSource.getRepository(Employee);

  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
  const previousId = shift.assignedEmployeeId;
  const toExclude = [...excludeEmployeeIds];
  if (previousId) toExclude.push(previousId);

  const { weekStart, weekEnd } = getWeekBounds(shift.date);
  const weekShifts = await shiftRepo.find({
    where: { date: Between(weekStart, weekEnd) },
  });

  const dayOfWeek = new Date(shift.date + "T00:00:00").getDay();
  const employees = await employeeRepo.find();

  const eligible = employees
    .filter((emp) => {
      if (emp.role !== shift.role) return false;
      if (toExclude.includes(emp.id)) return false;
      const availability: number[] = JSON.parse(emp.availability);
      if (!availability.includes(dayOfWeek)) return false;
      const hours = countAssignedHours(weekShifts, emp.id, weekStart, weekEnd);
      if (hours + HOURS_PER_SHIFT > emp.maxHoursPerWeek) return false;
      const alreadyAssigned = weekShifts.some(
        (s) => s.id !== shiftId && s.date === shift.date && s.period === shift.period && s.assignedEmployeeId === emp.id,
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
