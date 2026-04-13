import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Employee, Role } from "./Employee";
import { Schedule } from "./Schedule";

export type Period = "morning" | "afternoon" | "evening";

@Entity()
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar")
  date: string; // YYYY-MM-DD

  @Column("varchar")
  period: Period;

  @Column("varchar")
  role: Role;

  @ManyToOne(() => Employee, { nullable: true, eager: true })
  @JoinColumn({ name: "assignedEmployeeId" })
  assignedEmployee: Employee | null;

  @Column("int", { nullable: true })
  assignedEmployeeId: number | null;

  @Column("text", { nullable: true })
  explanation: string | null;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: "scheduleId" })
  schedule: Schedule | null;

  @Column("int", { nullable: true })
  scheduleId: number | null;
}
