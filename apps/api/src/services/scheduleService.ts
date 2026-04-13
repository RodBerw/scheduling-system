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

  return Promise.all(
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
}

/** Creates and persists a new schedule with the given name and date range. */
export async function createSchedule(name: string, startDate: string, endDate: string) {
  const repo = AppDataSource.getRepository(Schedule);
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
