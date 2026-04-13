import "reflect-metadata";
import { DataSource } from "typeorm";
import { Employee } from "./entities/Employee";
import { Shift } from "./entities/Shift";
import { ScheduleRequirement } from "./entities/ScheduleRequirement";
import { Schedule } from "./entities/Schedule";

export const AppDataSource = new DataSource({
  type: "sqljs",
  location: "./data/schedule.db",
  autoSave: true,
  synchronize: true,
  entities: [Employee, Shift, ScheduleRequirement, Schedule],
});
