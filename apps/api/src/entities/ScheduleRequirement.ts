import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Role } from "./Employee";
import { Period } from "./Shift";
import { Schedule } from "./Schedule";

@Entity()
export class ScheduleRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("int")
  dayOfWeek: number; // 0=Sunday, 6=Saturday

  @Column("varchar")
  role: Role;

  @Column("varchar")
  period: Period;

  @Column("int")
  requiredCount: number;

  @ManyToOne(() => Schedule, { nullable: true })
  @JoinColumn({ name: "scheduleId" })
  schedule: Schedule | null;

  @Column("int", { nullable: true })
  scheduleId: number | null;
}
