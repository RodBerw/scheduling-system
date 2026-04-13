/**
 * Employee service (frontend).
 * Provides API calls for retrieving employee records.
 */
import { api } from "./api";
import type { Employee } from "@/lib/types";

/** Fetches all employees, optionally filtered by role. */
export async function getEmployees(role?: string): Promise<Employee[]> {
  const query = role ? `?role=${role}` : "";
  const { data } = await api.get(`/employees${query}`);
  return data;
}
