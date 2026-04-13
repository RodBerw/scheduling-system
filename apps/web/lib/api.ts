import type { Employee, Shift, ChatResponse } from "./types";

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

export function getEmployees(role?: string): Promise<Employee[]> {
  const query = role ? `?role=${role}` : "";
  return fetchAPI(`/employees${query}`);
}

export function getSchedule(start: string, end: string): Promise<Shift[]> {
  return fetchAPI(`/schedule?start=${start}&end=${end}`);
}

export function generateSchedule(
  startDate: string,
  endDate: string,
): Promise<{ message: string; shifts: Shift[] }> {
  return fetchAPI("/schedule/generate", {
    method: "POST",
    body: JSON.stringify({ startDate, endDate }),
  });
}

export function replaceShift(
  shiftId: number,
): Promise<{ message: string; shift: Shift }> {
  return fetchAPI("/schedule/replace", {
    method: "POST",
    body: JSON.stringify({ shiftId }),
  });
}

export function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
): Promise<ChatResponse> {
  return fetchAPI("/chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
