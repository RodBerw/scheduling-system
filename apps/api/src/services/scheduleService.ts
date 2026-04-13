/**
 * Schedule service.
 * Contains business logic for schedule CRUD operations and staffing requirements management.
 */
import { AppDataSource } from "../data-source";
import { Schedule } from "../entities/Schedule";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import { Shift } from "../entities/Shift";

/**
 * Lists all schedules ordered by creation date (newest first),
 * enriched with shift summary counts and a flag indicating whether
 * staffing requirements have been defined.
 */
export async function listSchedules() {
  const schedules = await AppDataSource.getRepository(Schedule).find({
    order: { createdAt: "DESC" },
  });

  if (schedules.length === 0) return [];

  const scheduleIds = schedules.map((s) => s.id);

  // Single aggregated query for shift stats
  const shiftStats = await AppDataSource.getRepository(Shift)
    .createQueryBuilder("shift")
    .select("shift.scheduleId", "scheduleId")
    .addSelect("COUNT(*)", "totalShifts")
    .addSelect("SUM(CASE WHEN shift.assignedEmployeeId IS NOT NULL THEN 1 ELSE 0 END)", "filledShifts")
    .where("shift.scheduleId IN (:...ids)", { ids: scheduleIds })
    .groupBy("shift.scheduleId")
    .getRawMany();

  // Single query for requirement counts
  const reqStats = await AppDataSource.getRepository(ScheduleRequirement)
    .createQueryBuilder("req")
    .select("req.scheduleId", "scheduleId")
    .addSelect("COUNT(*)", "reqCount")
    .where("req.scheduleId IN (:...ids)", { ids: scheduleIds })
    .groupBy("req.scheduleId")
    .getRawMany();

  const shiftMap = new Map(shiftStats.map((r) => [r.scheduleId, r]));
  const reqMap = new Map(reqStats.map((r) => [r.scheduleId, Number(r.reqCount)]));

  return schedules.map((s) => {
    const stats = shiftMap.get(s.id);
    const totalShifts = stats ? Number(stats.totalShifts) : 0;
    const filledShifts = stats ? Number(stats.filledShifts) : 0;
    return {
      ...s,
      totalShifts,
      filledShifts,
      unfilledShifts: totalShifts - filledShifts,
      hasRequirements: (reqMap.get(s.id) || 0) > 0,
    };
  });
}

/** Creates and persists a new schedule with the given name and date range. */
export async function createSchedule(name: string, startDate: string, endDate: string) {
  const repo = AppDataSource.getRepository(Schedule);

  // Check for overlapping schedules
  const overlapping = await repo
    .createQueryBuilder("s")
    .where("s.startDate <= :endDate AND s.endDate >= :startDate", { startDate, endDate })
    .getOne();

  if (overlapping) {
    throw new Error(
      `Date range overlaps with existing schedule "${overlapping.name}" (${overlapping.startDate} to ${overlapping.endDate})`
    );
  }

  const schedule = repo.create({ name, startDate, endDate });
  return repo.save(schedule);
}

/** Retrieves a single schedule by ID. Throws if not found. */
export async function getScheduleById(id: number) {
  return AppDataSource.getRepository(Schedule).findOneOrFail({ where: { id } });
}

/**
 * Deletes a schedule and all associated data (shifts and requirements)
 * to maintain referential integrity.
 */
export async function deleteSchedule(id: number) {
  await AppDataSource.getRepository(Shift).delete({ scheduleId: id });
  await AppDataSource.getRepository(ScheduleRequirement).delete({ scheduleId: id });
  await AppDataSource.getRepository(Schedule).delete(id);
}

/** Retrieves staffing requirements for a schedule, sorted by day, period, and role. */
export async function getRequirements(scheduleId: number) {
  return AppDataSource.getRepository(ScheduleRequirement).find({
    where: { scheduleId },
    order: { dayOfWeek: "ASC", period: "ASC", role: "ASC" },
  });
}

/**
 * Replaces all staffing requirements for a schedule in a single transaction.
 * Existing requirements are deleted before the new ones are inserted.
 */
export async function setRequirements(
  scheduleId: number,
  requirements: { dayOfWeek: number; role: string; period: string; requiredCount: number }[],
) {
  const repo = AppDataSource.getRepository(ScheduleRequirement);
  await repo.delete({ scheduleId });
  const entities = requirements.map((r) =>
    repo.create({ ...r, scheduleId } as Partial<ScheduleRequirement>),
  );
  return repo.save(entities);
}
