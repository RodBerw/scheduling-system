/**
 * Schedule controller.
 * Handles HTTP request/response logic for schedule and requirement endpoints.
 * Delegates business logic to scheduleService.
 */
import { Request, Response } from "express";
import * as scheduleService from "../services/scheduleService";

/** GET /schedules — List all schedules with summary counts */
export async function list(_req: Request, res: Response) {
  const result = await scheduleService.listSchedules();
  res.json(result);
}

/** POST /schedules — Create a new schedule */
export async function create(req: Request, res: Response) {
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: "name, startDate, and endDate are required" });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
  }

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: "Invalid date values" });
  }
  if (end < start) {
    return res.status(400).json({ error: "endDate must be on or after startDate" });
  }

  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) {
    return res.status(400).json({ error: "Schedule range cannot exceed 90 days" });
  }

  try {
    const saved = await scheduleService.createSchedule(name, startDate, endDate);
    res.status(201).json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create schedule";
    res.status(400).json({ error: message });
  }
}

/** GET /schedules/:id — Get a single schedule by ID */
export async function getById(req: Request, res: Response) {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid schedule ID" });
  }
  try {
    const schedule = await scheduleService.getScheduleById(id);
    res.json(schedule);
  } catch {
    res.status(404).json({ error: "Schedule not found" });
  }
}

/** DELETE /schedules/:id — Delete a schedule and all its related shifts and requirements */
export async function remove(req: Request, res: Response) {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid schedule ID" });
  }
  try {
    await scheduleService.deleteSchedule(id);
    res.json({ message: "Schedule deleted" });
  } catch {
    res.status(404).json({ error: "Schedule not found" });
  }
}

/** GET /schedules/:id/requirements — List staffing requirements for a schedule */
export async function getRequirements(req: Request, res: Response) {
  const scheduleId = parseInt(req.params.id as string);
  if (isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule ID" });
  }
  const reqs = await scheduleService.getRequirements(scheduleId);
  res.json(reqs);
}

/** POST /schedules/:id/requirements — Bulk replace staffing requirements for a schedule */
export async function setRequirements(req: Request, res: Response) {
  const scheduleId = parseInt(req.params.id as string);
  if (isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid schedule ID" });
  }
  const { requirements } = req.body;

  if (!requirements || !Array.isArray(requirements)) {
    return res.status(400).json({ error: "requirements array is required" });
  }

  const saved = await scheduleService.setRequirements(scheduleId, requirements);
  res.json({ message: `Set ${saved.length} requirements`, requirements: saved });
}
