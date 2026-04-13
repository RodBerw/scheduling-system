export type Role = "cook" | "waiter" | "dishwasher" | "manager";
export type Period = "morning" | "afternoon" | "evening";

export interface Employee {
  id: number;
  name: string;
  role: Role;
  maxHoursPerWeek: number;
  availability: string; // JSON array
}

export interface Shift {
  id: number;
  date: string;
  period: Period;
  role: Role;
  assignedEmployeeId: number | null;
  assignedEmployee: Employee | null;
  explanation: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  actions: { type: string; result?: unknown }[];
}
