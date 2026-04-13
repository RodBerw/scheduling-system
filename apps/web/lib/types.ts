export type Role = "cook" | "waiter" | "dishwasher" | "manager";
export type Period = "morning" | "afternoon" | "evening";

export interface Employee {
  id: number;
  name: string;
  role: Role;
  maxHoursPerWeek: number;
  availability: string;
}

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

export interface Shift {
  id: number;
  date: string;
  period: Period;
  role: Role;
  assignedEmployeeId: number | null;
  assignedEmployee: Employee | null;
  explanation: string | null;
  scheduleId: number | null;
}

export interface ScheduleRequirement {
  id: number;
  dayOfWeek: number;
  role: Role;
  period: Period;
  requiredCount: number;
  scheduleId: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  actions: { type: string; success: boolean; message: string }[];
}
