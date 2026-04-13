import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("varchar")
  name: string;

  @Column("varchar")
  startDate: string; // YYYY-MM-DD

  @Column("varchar")
  endDate: string; // YYYY-MM-DD

  @CreateDateColumn()
  createdAt: Date;
}
