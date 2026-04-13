/**
 * Shift service.
 * Contains business logic for querying shifts, manual employee assignment,
 * and determining employee eligibility for a given shift.
 */
import { AppDataSource } from "../data-source";
import { Shift } from "../entities/Shift";
import { Employee } from "../entities/Employee";
import { Between } from "typeorm";

const HOURS_PER_SHIFT = 4;

/** Safely parses a JSON availability array, returning empty array on failure. */
function parseAvailability(employee: Employee): number[] {
  try {
    return JSON.parse(employee.availability);
  } catch {
    console.warn(`Invalid availability JSON for employee ${employee.id} (${employee.name})`);
    return [];
  }
}

/** Retrieves all shifts belonging to a schedule, ordered by date and period. */
export async function getShiftsBySchedule(scheduleId: number) {
  return AppDataSource.getRepository(Shift).find({
    where: { scheduleId },
    order: { date: "ASC", period: "ASC" },
  });
}

/**
 * Manually assigns or unassigns an employee to a shift.
 * Validates employee existence, role match, availability, and weekly hour limit.
 * Returns the updated shift with its employee relation loaded.
 */
export async function assignEmployee(shiftId: number, employeeId: number | null) {
  const shiftRepo = AppDataSource.getRepository(Shift);
  const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });

  if (employeeId == null) {
    shift.assignedEmployeeId = null;
    shift.assignedEmployee = null;
    shift.explanation = "Manually unassigned";
    const saved = await shiftRepo.save(shift);
    return shiftRepo.findOne({ where: { id: saved.id } });
  }

  const employeeRepo = AppDataSource.getRepository(Employee);
  const employee = await employeeRepo.findOne({ where: { id: employeeId } });
  if (!employee) {
    throw new Error("Employee not found");
  }

  if (employee.role !== shift.role) {
    throw new Error(`Employee role "${employee.role}" does not match shift role "${shift.role}"`);
  }

  const dayOfWeek = new Date(shift.date + "T00:00:00Z").getUTCDay();
  const availability = parseAvailability(employee);
  if (!availability.includes(dayOfWeek)) {
    throw new Error(`Employee "${employee.name}" is not available on this day`);
  }

  // Check weekly hour limit
  const d = new Date(shift.date + "T00:00:00Z");
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = sunday.toISOString().split("T")[0];

  const weekShifts = await shiftRepo.find({
    where: { date: Between(weekStart, weekEnd) },
  });
  const currentHours = weekShifts.filter(
    (s) => s.assignedEmployeeId === employeeId && s.id !== shiftId
  ).length * HOURS_PER_SHIFT;

  if (currentHours + HOURS_PER_SHIFT > employee.maxHoursPerWeek) {
    throw new Error(
      `Assigning this shift would exceed ${employee.name}'s weekly limit of ${employee.maxHoursPerWeek}h (currently at ${currentHours}h)`
    );
  }

  // Check for duplicate assignment in same date+period
  const duplicate = weekShifts.find(
    (s) =>
      s.id !== shiftId &&
      s.date === shift.date &&
      s.period === shift.period &&
      s.assignedEmployeeId === employeeId
  );
  if (duplicate) {
    throw new Error(`Employee "${employee.name}" is already assigned to another ${shift.period} shift on ${shift.date}`);
  }

  shift.assignedEmployeeId = employeeId;
  shift.assignedEmployee = employee;
  shift.explanation = "Manually assigned";
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
  const dayOfWeek = new Date(shift.date + "T00:00:00Z").getUTCDay();

  return employees.filter((emp) => {
    if (emp.role !== shift.role) return false;
    const availability = parseAvailability(emp);
    return availability.includes(dayOfWeek);
  });
}
