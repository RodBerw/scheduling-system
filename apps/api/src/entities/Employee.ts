/**
 * Employee entity.
 * Represents a restaurant staff member with a specific role,
 * weekly hour limit, and day-of-week availability stored as a JSON array.
 */
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

  /** Maximum number of hours this employee can work per week */
  @Column("int", { default: 40 })
  maxHoursPerWeek: number;

  /** JSON-encoded array of weekday numbers the employee is available (0=Sunday, 6=Saturday) */
  @Column("text")
  availability: string;
}
