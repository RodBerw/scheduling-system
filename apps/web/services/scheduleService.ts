/**
 * Schedule service (frontend).
 * Provides API calls for schedule CRUD operations and staffing requirements.
 */
import { api } from "./api";
import type { Schedule, ScheduleRequirement } from "@/lib/types";

/** Fetches all schedules with summary counts. */
export async function getSchedules(): Promise<Schedule[]> {
  const { data } = await api.get("/schedules");
  return data;
}

/** Fetches a single schedule by ID. */
export async function getSchedule(id: number): Promise<Schedule> {
  const { data } = await api.get(`/schedules/${id}`);
  return data;
}

/** Creates a new schedule with the given name and date range. */
export async function createSchedule(name: string, startDate: string, endDate: string): Promise<Schedule> {
  const { data } = await api.post("/schedules", { name, startDate, endDate });
  return data;
}

/** Deletes a schedule and all its associated data. */
export async function deleteSchedule(id: number): Promise<void> {
  await api.delete(`/schedules/${id}`);
}

/** Fetches staffing requirements for a schedule. */
export async function getRequirements(scheduleId: number): Promise<ScheduleRequirement[]> {
  const { data } = await api.get(`/schedules/${scheduleId}/requirements`);
  return data;
}

/** Bulk replaces all staffing requirements for a schedule. */
export async function setRequirements(
  scheduleId: number,
  requirements: Omit<ScheduleRequirement, "id" | "scheduleId">[],
): Promise<{ message: string; requirements: ScheduleRequirement[] }> {
  const { data } = await api.post(`/schedules/${scheduleId}/requirements`, { requirements });
  return data;
}
