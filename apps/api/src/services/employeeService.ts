/**
 * Employee service.
 * Contains business logic for retrieving employee records.
 */
import { AppDataSource } from "../data-source";
import { Employee, Role } from "../entities/Employee";

const VALID_ROLES: Role[] = ["cook", "waiter", "dishwasher", "manager"];

/** Retrieves all employees, optionally filtered by role. */
export async function getEmployees(role?: string) {
  if (role && !VALID_ROLES.includes(role as Role)) {
    throw new Error(`Invalid role "${role}". Valid roles: ${VALID_ROLES.join(", ")}`);
  }
  const where = role ? { role: role as Role } : {};
  return AppDataSource.getRepository(Employee).find({ where });
}
