import type { Employee, Shift, Schedule, ScheduleRequirement, ChatResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API request failed");
  }
  return res.json();
}

// Schedules
export function getSchedules(): Promise<Schedule[]> {
  return fetchAPI("/schedules");
}

export function getSchedule(id: number): Promise<Schedule> {
  return fetchAPI(`/schedules/${id}`);
}

export function createSchedule(name: string, startDate: string, endDate: string): Promise<Schedule> {
  return fetchAPI("/schedules", {
    method: "POST",
    body: JSON.stringify({ name, startDate, endDate }),
  });
}

export function deleteSchedule(id: number): Promise<void> {
  return fetchAPI(`/schedules/${id}`, { method: "DELETE" });
}

// Requirements
export function getRequirements(scheduleId: number): Promise<ScheduleRequirement[]> {
  return fetchAPI(`/schedules/${scheduleId}/requirements`);
}

export function setRequirements(
  scheduleId: number,
  requirements: Omit<ScheduleRequirement, "id" | "scheduleId">[],
): Promise<{ message: string; requirements: ScheduleRequirement[] }> {
  return fetchAPI(`/schedules/${scheduleId}/requirements`, {
    method: "POST",
    body: JSON.stringify({ requirements }),
  });
}

// Shifts
export function getShifts(scheduleId: number): Promise<Shift[]> {
  return fetchAPI(`/shifts?scheduleId=${scheduleId}`);
}

export function generateShifts(scheduleId: number): Promise<{ message: string; shifts: Shift[] }> {
  return fetchAPI("/shifts/generate", {
    method: "POST",
    body: JSON.stringify({ scheduleId }),
  });
}

export function replaceShift(shiftId: number): Promise<{ message: string; shift: Shift }> {
  return fetchAPI("/shifts/replace", {
    method: "POST",
    body: JSON.stringify({ shiftId }),
  });
}

export function assignEmployee(
  shiftId: number,
  employeeId: number | null,
): Promise<{ message: string; shift: Shift }> {
  return fetchAPI("/shifts/assign", {
    method: "POST",
    body: JSON.stringify({ shiftId, employeeId }),
  });
}

export function getEligibleEmployees(shiftId: number): Promise<Employee[]> {
  return fetchAPI(`/shifts/eligible/${shiftId}`);
}

// Employees
export function getEmployees(role?: string): Promise<Employee[]> {
  const query = role ? `?role=${role}` : "";
  return fetchAPI(`/employees${query}`);
}

// Chat
export function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  scheduleId: number,
): Promise<ChatResponse> {
  return fetchAPI("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history, scheduleId }),
  });
}
