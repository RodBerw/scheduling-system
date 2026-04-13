/**
 * Employee service.
 * Contains business logic for retrieving employee records.
 */
import { AppDataSource } from "../data-source";
import { Employee, Role } from "../entities/Employee";

/** Retrieves all employees, optionally filtered by role. */
export async function getEmployees(role?: string) {
  const where = role ? { role: role as Role } : {};
  return AppDataSource.getRepository(Employee).find({ where });
}
