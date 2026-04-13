/**
 * Shift controller.
 * Handles HTTP request/response logic for shift-related endpoints.
 * Delegates business logic to shiftService and the scheduler service.
 */
import { Request, Response } from "express";
import * as shiftService from "../services/shiftService";
import { generateSchedule, replaceEmployee } from "../services/scheduler";

/** GET /shifts?scheduleId=X — List all shifts for a given schedule */
export async function list(req: Request, res: Response) {
  const { scheduleId } = req.query;
  if (!scheduleId) {
    return res.status(400).json({ error: "scheduleId is required" });
  }
  const shifts = await shiftService.getShiftsBySchedule(parseInt(scheduleId as string));
  res.json(shifts);
}

/** POST /shifts/generate — Auto-generate shifts for a schedule based on its requirements */
export async function generate(req: Request, res: Response) {
  const { scheduleId } = req.body;
  if (!scheduleId) {
    return res.status(400).json({ error: "scheduleId is required" });
  }
  try {
    const shifts = await generateSchedule(scheduleId);
    res.json({ message: `Generated ${shifts.length} shifts`, shifts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
}

/** POST /shifts/replace — Find a replacement employee for an existing shift */
export async function replace(req: Request, res: Response) {
  const { shiftId } = req.body;
  if (!shiftId) {
    return res.status(400).json({ error: "shiftId is required" });
  }
  try {
    const shift = await replaceEmployee(shiftId);
    res.json({ message: "Replacement complete", shift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Replace failed";
    res.status(404).json({ error: message });
  }
}

/** POST /shifts/assign — Manually assign or unassign an employee to a shift */
export async function assign(req: Request, res: Response) {
  const { shiftId, employeeId } = req.body;
  if (!shiftId) {
    return res.status(400).json({ error: "shiftId is required" });
  }
  try {
    const shift = await shiftService.assignEmployee(shiftId, employeeId);
    res.json({ message: "Assignment updated", shift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Assignment failed";
    res.status(400).json({ error: message });
  }
}

/** GET /shifts/eligible/:shiftId — List employees eligible to fill a specific shift */
export async function eligible(req: Request, res: Response) {
  const shiftId = parseInt(req.params.shiftId as string);
  if (isNaN(shiftId)) {
    return res.status(400).json({ error: "Invalid shiftId" });
  }
  try {
    const employees = await shiftService.getEligibleEmployees(shiftId);
    res.json(employees);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get eligible employees";
    res.status(400).json({ error: message });
  }
}
