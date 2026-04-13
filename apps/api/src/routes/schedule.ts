import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Shift } from "../entities/Shift";
import { Employee } from "../entities/Employee";
import { generateSchedule, replaceEmployee } from "../services/scheduler";

const router = Router();

// GET /shifts?scheduleId=X
router.get("/", async (req, res) => {
  const { scheduleId } = req.query;
  if (!scheduleId) {
    return res.status(400).json({ error: "scheduleId is required" });
  }
  const shifts = await AppDataSource.getRepository(Shift).find({
    where: { scheduleId: parseInt(scheduleId as string) },
    order: { date: "ASC", period: "ASC" },
  });
  res.json(shifts);
});

// POST /shifts/generate
router.post("/generate", async (req, res) => {
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
});

// POST /shifts/replace
router.post("/replace", async (req, res) => {
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
});

// POST /shifts/assign
router.post("/assign", async (req, res) => {
  const { shiftId, employeeId } = req.body;
  if (!shiftId) {
    return res.status(400).json({ error: "shiftId is required" });
  }
  try {
    const shiftRepo = AppDataSource.getRepository(Shift);
    const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
    shift.assignedEmployeeId = employeeId ?? null;
    shift.explanation = employeeId ? "Manually assigned" : "Manually unassigned";
    const saved = await shiftRepo.save(shift);
    const result = await shiftRepo.findOne({ where: { id: saved.id } });
    res.json({ message: "Assignment updated", shift: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Assignment failed";
    res.status(400).json({ error: message });
  }
});

// GET /shifts/eligible/:shiftId
router.get("/eligible/:shiftId", async (req, res) => {
  const shiftId = parseInt(req.params.shiftId);
  try {
    const shiftRepo = AppDataSource.getRepository(Shift);
    const shift = await shiftRepo.findOneOrFail({ where: { id: shiftId } });
    const employees = await AppDataSource.getRepository(Employee).find();
    const dayOfWeek = new Date(shift.date + "T00:00:00").getDay();

    const eligible = employees.filter((emp) => {
      if (emp.role !== shift.role) return false;
      const availability: number[] = JSON.parse(emp.availability);
      return availability.includes(dayOfWeek);
    });
    res.json(eligible);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get eligible employees";
    res.status(400).json({ error: message });
  }
});

export default router;
