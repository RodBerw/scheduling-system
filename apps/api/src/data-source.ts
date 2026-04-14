/**
 * TypeORM data source configuration.
 * Uses sql.js (SQLite compiled to WASM) as the database engine,
 * with auto-save and automatic schema synchronization enabled.
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import { mkdirSync } from "fs";
import { Employee } from "./entities/Employee";
import { Shift } from "./entities/Shift";
import { ScheduleRequirement } from "./entities/ScheduleRequirement";
import { Schedule } from "./entities/Schedule";

// Create the data directory if it doesn't exist
mkdirSync("./data", { recursive: true });

export const AppDataSource = new DataSource({
  type: "sqljs",
  location: "./data/schedule.db",
  autoSave: true,
  synchronize: true,
  entities: [Employee, Shift, ScheduleRequirement, Schedule],
});
