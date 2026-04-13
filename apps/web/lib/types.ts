/**
 * Shared TypeScript types for the frontend application.
 * These mirror the backend entity shapes returned by the API.
 */

/** Employee roles available in the restaurant */
export type Role = "cook" | "waiter" | "dishwasher" | "manager";

/** Work periods within a day */
export type Period = "morning" | "afternoon" | "evening";

/** A restaurant staff member */
export interface Employee {
  id: number;
  name: string;
  role: Role;
  maxHoursPerWeek: number;
  /** JSON-encoded array of available weekday numbers (0=Sunday, 6=Saturday) */
  availability: string;
}

/** A named scheduling period (e.g., a work week) */
export interface Schedule {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  totalShifts?: number;
  filledShifts?: number;
  unfilledShifts?: number;
  hasRequirements?: boolean;
}

/** A single work slot on a specific date, period, and role */
export interface Shift {
  id: number;
  date: string;
  period: Period;
  role: Role;
  assignedEmployeeId: number | null;
  assignedEmployee: Employee | null;
  /** Human-readable explanation for the assignment decision */
  explanation: string | null;
  scheduleId: number | null;
}

/** Defines how many employees of a role are needed for a day/period */
export interface ScheduleRequirement {
  id: number;
  /** Day of the week: 0=Sunday, 1=Monday, ..., 6=Saturday */
  dayOfWeek: number;
  role: Role;
  period: Period;
  requiredCount: number;
  scheduleId: number | null;
}

/** A single message in the chat conversation */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Response from the AI chat endpoint */
export interface ChatResponse {
  reply: string;
  /** Actions that were executed as a result of the AI's response */
  actions: { type: string; success: boolean; message: string }[];
}
