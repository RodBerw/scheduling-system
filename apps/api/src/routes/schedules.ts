import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { Shift } from "../entities/Shift";

const router = Router();

// GET /schedules — list all schedules
router.get("/", async (_req, res) => {
  const schedules = await AppDataSource.getRepository(Schedule).find({
    order: { createdAt: "DESC" },
  });

  // Attach summary counts
  const result = await Promise.all(
    schedules.map(async (s) => {
      const totalShifts = await AppDataSource.getRepository(Shift).count({
        where: { scheduleId: s.id },
      });
      const filledShifts = await AppDataSource.getRepository(Shift)
        .createQueryBuilder("shift")
        .where("shift.scheduleId = :id", { id: s.id })
        .andWhere("shift.assignedEmployeeId IS NOT NULL")
        .getCount();
      const requirementCount = await AppDataSource.getRepository(ScheduleRequirement).count({
        where: { scheduleId: s.id },
      });
      return {
        ...s,
        totalShifts,
        filledShifts,
        unfilledShifts: totalShifts - filledShifts,
        hasRequirements: requirementCount > 0,
      };
    }),
  );

  res.json(result);
});

// POST /schedules — create a schedule
router.post("/", async (req, res) => {
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: "name, startDate, and endDate are required" });
  }
  const repo = AppDataSource.getRepository(Schedule);
  const schedule = repo.create({ name, startDate, endDate });
  const saved = await repo.save(schedule);
  res.status(201).json(saved);
});

// GET /schedules/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const schedule = await AppDataSource.getRepository(Schedule).findOneOrFail({ where: { id } });
    res.json(schedule);
  } catch {
    res.status(404).json({ error: "Schedule not found" });
  }
});

// DELETE /schedules/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await AppDataSource.getRepository(Shift).delete({ scheduleId: id });
    await AppDataSource.getRepository(ScheduleRequirement).delete({ scheduleId: id });
    await AppDataSource.getRepository(Schedule).delete(id);
    res.json({ message: "Schedule deleted" });
  } catch {
    res.status(404).json({ error: "Schedule not found" });
  }
});

// GET /schedules/:id/requirements
router.get("/:id/requirements", async (req, res) => {
  const scheduleId = parseInt(req.params.id);
  const reqs = await AppDataSource.getRepository(ScheduleRequirement).find({
    where: { scheduleId },
    order: { dayOfWeek: "ASC", period: "ASC", role: "ASC" },
  });
  res.json(reqs);
});

// POST /schedules/:id/requirements — bulk set requirements
router.post("/:id/requirements", async (req, res) => {
  const scheduleId = parseInt(req.params.id);
  const { requirements } = req.body as {
    requirements: { dayOfWeek: number; role: string; period: string; requiredCount: number }[];
  };

  if (!requirements || !Array.isArray(requirements)) {
    return res.status(400).json({ error: "requirements array is required" });
  }

  const repo = AppDataSource.getRepository(ScheduleRequirement);

  // Delete existing requirements for this schedule
  await repo.delete({ scheduleId });

  // Create new ones
  const entities = requirements.map((r) =>
    repo.create({ ...r, scheduleId }),
  );
  const saved = await repo.save(entities);
  res.json({ message: `Set ${saved.length} requirements`, requirements: saved });
});

export default router;
