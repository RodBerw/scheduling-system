import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Shift } from "../entities/Shift";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { generateSchedule, replaceEmployee } from "../services/scheduler";
import { Between } from "typeorm";

const router = Router();

// GET /schedule?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    // Default to current week (Monday to Sunday)
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const shifts = await AppDataSource.getRepository(Shift).find({
      where: {
        date: Between(
          monday.toISOString().split("T")[0],
          sunday.toISOString().split("T")[0],
        ),
      },
      order: { date: "ASC", period: "ASC" },
    });
    return res.json(shifts);
  }

  const shifts = await AppDataSource.getRepository(Shift).find({
    where: { date: Between(start as string, end as string) },
    order: { date: "ASC", period: "ASC" },
  });
  res.json(shifts);
});

// GET /schedule/requirements
router.get("/requirements", async (_req, res) => {
  const reqs = await AppDataSource.getRepository(ScheduleRequirement).find({
    order: { dayOfWeek: "ASC", period: "ASC" },
  });
  res.json(reqs);
});

// POST /schedule/generate
router.post("/generate", async (req, res) => {
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }
  try {
    const shifts = await generateSchedule(startDate, endDate);
    res.json({ message: `Generated ${shifts.length} shifts`, shifts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    res.status(500).json({ error: message });
  }
});

// POST /schedule/replace
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

export default router;
