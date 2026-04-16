
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { Employee, Role } from "./Employee";
import { Schedule } from "./Schedule";

export type Period = "morning" | "afternoon" | "evening";

/**
 * Chronological ordering for periods. SQL sort on `period` alone is alphabetical
 * (afternoon < evening < morning), which misrepresents time-of-day. Callers that
 * need the natural sequence should sort in memory with this comparator.
 */
const PERIOD_ORDER: Record<Period, number> = { morning: 0, afternoon: 1, evening: 2 };
export function comparePeriods(a: Period, b: Period): number {
  return PERIOD_ORDER[a] - PERIOD_ORDER[b];
}

@Entity()
@Unique("uq_shift_assignment", [
  "scheduleId",
  "date",
  "period",
  "role",
  "assignedEmployeeId",
])
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  /** Shift date in YYYY-MM-DD format */
  @Column("varchar")
  date: string;

  @Column("varchar")
  period: Period;

  @Column("varchar")
  role: Role;

  /** Eagerly loaded employee relation; null when the shift is unfilled */
  @ManyToOne(() => Employee, { nullable: true, eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assignedEmployeeId" })
  assignedEmployee: Employee | null;

  @Column("int", { nullable: true })
  assignedEmployeeId: number | null;

  /** Human-readable reason for the current assignment state */
  @Column("text", { nullable: true })
  explanation: string | null;

  @ManyToOne(() => Schedule, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "scheduleId" })
  schedule: Schedule | null;

  @Column("int", { nullable: true })
  scheduleId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
