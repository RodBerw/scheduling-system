/**
 * Shift service (frontend).
 * Provides API calls for querying, generating, replacing, and assigning shifts.
 */
import { api } from "./api";
import type { Employee, Shift } from "@/lib/types";

/** Fetches all shifts for a given schedule, ordered by date and period. */
export async function getShifts(scheduleId: number): Promise<Shift[]> {
  const { data } = await api.get(`/shifts?scheduleId=${scheduleId}`);
  return data;
}

/** Triggers automatic shift generation for a schedule based on its requirements. */
export async function generateShifts(scheduleId: number): Promise<{ message: string; shifts: Shift[] }> {
  const { data } = await api.post("/shifts/generate", { scheduleId });
  return data;
}

/** Requests a replacement employee for an existing shift. */
export async function replaceShift(shiftId: number): Promise<{ message: string; shift: Shift }> {
  const { data } = await api.post("/shifts/replace", { shiftId });
  return data;
}

/** Manually assigns or unassigns an employee to a shift. Pass null to unassign. */
export async function assignEmployee(
  shiftId: number,
  employeeId: number | null,
): Promise<{ message: string; shift: Shift }> {
  const { data } = await api.post("/shifts/assign", { shiftId, employeeId });
  return data;
}

/** Fetches employees eligible to fill a specific shift (matching role and availability). */
export async function getEligibleEmployees(shiftId: number): Promise<Employee[]> {
  const { data } = await api.get(`/shifts/eligible/${shiftId}`);
  return data;
}
