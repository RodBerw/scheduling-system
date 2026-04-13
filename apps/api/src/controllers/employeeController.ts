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
  const employees = await employeeService.getEmployees(role as string | undefined);
  res.json(employees);
}
