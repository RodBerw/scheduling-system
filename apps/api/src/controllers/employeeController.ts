/**
 * Employee controller.
 * Handles HTTP request/response logic for employee endpoints.
 * Delegates business logic to employeeService.
 */
import { Request, Response } from "express";
import * as employeeService from "../services/employeeService";

/** GET /employees?role=X — List employees, optionally filtered by role */
export async function list(req: Request, res: Response) {
  const { role } = req.query;
  try {
    const employees = await employeeService.getEmployees(role as string | undefined);
    res.json(employees);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list employees";
    res.status(400).json({ error: message });
  }
}
