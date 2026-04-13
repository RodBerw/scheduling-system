import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { Role } from "./Employee";
import { Period } from "./Shift";

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
}
