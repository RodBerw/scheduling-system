import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";

@Entity()
@Unique("uq_schedule_name", ["name"])
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

  @UpdateDateColumn()
  updatedAt: Date;
}
