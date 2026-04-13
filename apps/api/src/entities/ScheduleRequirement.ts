/**
 * ScheduleRequirement entity.
 * Defines how many employees of a given role are needed for a specific
 * day-of-week and period within a schedule. Used by the scheduler service
 * to generate the correct number of shifts.
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Role } from "./Employee";
import { Period } from "./Shift";
import { Schedule } from "./Schedule";

@Entity()
export class ScheduleRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  /** Day of the week: 0=Sunday, 1=Monday, ..., 6=Saturday */
  @Column("int")
  dayOfWeek: number;

  @Column("varchar")
  role: Role;

  @Column("varchar")
  period: Period;

  /** Number of employees needed for this role/period/day combination */
  @Column("int")
  requiredCount: number;

  @ManyToOne(() => Schedule, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scheduleId" })
  schedule: Schedule | null;

  @Column("int", { nullable: true })
  scheduleId: number | null;
}
