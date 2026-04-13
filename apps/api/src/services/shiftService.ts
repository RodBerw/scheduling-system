/**
 * Shift service.
 * Contains business logic for querying shifts, manual employee assignment,
 * and determining employee eligibility for a given shift.
 */
import { AppDataSource } from "../data-source";
import { Shift } from "../entities/Shift";
import { Employee } from "../entities/Employee";

/** Retrieves all shifts belonging to a schedule, ordered by date and period. */
export async function getShiftsBySchedule(scheduleId: number) {
  return AppDataSource.getRepository(Shift).find({
    where: { scheduleId },
    order: { date: "ASC", period: "ASC" },
  });
}

/**
 * Manually assigns or unassigns an employee to a shift.
 * Sets the explanation field to indicate this was a manual action.
 * Returns the updated shift with its employee relation loaded.
 */
export async function assignEmployee(shiftId: number, employeeId: number | null) {
  const shiftRepo = AppDataSource.getRepository(Shift);
  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
  shift.assignedEmployeeId = employeeId ?? null;
  shift.explanation = employeeId ? "Manually assigned" : "Manually unassigned";
  const saved = await shiftRepo.save(shift);
  return shiftRepo.findOne({ where: { id: saved.id } });
}

/**
 * Returns all employees eligible to fill a specific shift.
 * Filters by matching role and day-of-week availability.
 */
export async function getEligibleEmployees(shiftId: number) {
  const shiftRepo = AppDataSource.getRepository(Shift);
  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
  const employees = await AppDataSource.getRepository(Employee).find();
  const dayOfWeek = new Date(shift.date + "T00:00:00").getDay();

  return employees.filter((emp) => {
    if (emp.role !== shift.role) return false;
    const availability: number[] = JSON.parse(emp.availability);
    return availability.includes(dayOfWeek);
  });
}
