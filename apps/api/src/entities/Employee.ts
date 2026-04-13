import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

export type Role = "cook" | "waiter" | "dishwasher" | "manager";

@Entity()
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar")
  name: string;

  @Column("varchar")
  role: Role;

  @Column("int", { default: 40 })
  maxHoursPerWeek: number;

  @Column("text")
  availability: string; // JSON array of weekday numbers (0=Sunday, 6=Saturday)
}
