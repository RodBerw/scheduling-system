import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";

export type Role = "cook" | "waiter" | "dishwasher" | "manager";

@Entity()
@Unique("uq_employee_name", ["name"])
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar")
  name: string;

  @Column("varchar")
  role: Role;

  /** Maximum number of hours this employee can work per week */
  @Column("int", { default: 40 })
  maxHoursPerWeek: number;

  /** JSON-encoded array of weekday numbers the employee is available (0=Sunday, 6=Saturday) */
  @Column("text")
  availability: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
