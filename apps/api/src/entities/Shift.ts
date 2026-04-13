/**
 * Shift entity.
 * Represents a single work slot on a specific date, period, and role.
 * May or may not have an assigned employee. The explanation field records
 * the reasoning behind the assignment (or why it was left unfilled).
 */
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Employee, Role } from "./Employee";
import { Schedule } from "./Schedule";

export type Period = "morning" | "afternoon" | "evening";

@Entity()
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
  @ManyToOne(() => Employee, { nullable: true, eager: true })
  @JoinColumn({ name: "assignedEmployeeId" })
  assignedEmployee: Employee | null;

  @Column("int", { nullable: true })
  assignedEmployeeId: number | null;

  /** Human-readable reason for the current assignment state */
  @Column("text", { nullable: true })
  explanation: string | null;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: "scheduleId" })
  schedule: Schedule | null;

  @Column("int", { nullable: true })
  scheduleId: number | null;
}
