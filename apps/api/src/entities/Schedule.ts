/**
 * Schedule entity.
 * Represents a named scheduling period defined by a start and end date (e.g., a work week).
 * Serves as the parent for shifts and staffing requirements.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar")
  name: string;

  /** Schedule start date in YYYY-MM-DD format */
  @Column("varchar")
  startDate: string;

  /** Schedule end date in YYYY-MM-DD format */
  @Column("varchar")
  endDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
