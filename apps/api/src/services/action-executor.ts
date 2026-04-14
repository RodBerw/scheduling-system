/**
 * Action executor — runs parsed scheduling actions against the database.
 * Extracted into its own module so both ai-chat.ts and mock-chat.ts
 * can import it without a circular dependency.
 */
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";
import { Shift } from "../entities/Shift";
import { ScheduleRequirement } from "../entities/ScheduleRequirement";
import {
  generateSchedule,
  replaceEmployee,
  replaceEmployeeBatch,
  swapEmployees,
} from "./scheduler";

export interface ParsedAction {
  type: string;
  [key: string]: unknown;
}

/**
 * Executes a single parsed action against the database.
 * Supports: set_requirements, generate_schedule, replace_employee,
 * replace_employee_batch, delete_shifts, assign_employee,
 * unassign_employee, swap_employees.
 */
export async function executeAction(
  action: ParsedAction,
  scheduleId: number
): Promise<{ type: string; success: boolean; message: string }> {
  switch (action.type) {
    case "set_requirements": {
      const { requirements } = action as {
        type: string;
        requirements: {
          dayOfWeek: number;
          role: string;
          period: string;
          requiredCount: number;
        }[];
      };

      // Check if the requirements are valid
      if (!requirements || !Array.isArray(requirements)) {
        return {
          type: action.type,
          success: false,
          message: "Invalid requirements format",
        };
      }

      // Merge with existing requirements instead of replacing all
      const repo = AppDataSource.getRepository(ScheduleRequirement);
      const existing = await repo.find({ where: { scheduleId } });

      // Iterate through the requirements
      const saved: ScheduleRequirement[] = [];
      for (const r of requirements) {
        // Check if the requirement already exists
        const match = existing.find(
          (e) =>
            e.dayOfWeek === r.dayOfWeek &&
            e.role === r.role &&
            e.period === r.period
        );
        if (match) {
          // If the requirement is being removed, remove it
          if (r.requiredCount === 0) {
            await repo.remove(match);
          } else {
            // If the requirement is being updated, update it
            match.requiredCount = r.requiredCount;
            saved.push(await repo.save(match));
          }
        } else if (r.requiredCount > 0) {
          // If the requirement is new, create it
          const entity = repo.create({
            ...r,
            scheduleId,
          } as Partial<ScheduleRequirement>);
          saved.push(await repo.save(entity));
        }
      }
      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Set ${saved.length} staffing requirements`,
      };
    }
    case "generate_schedule": {
      try {
        // Generate the schedule
        const shifts = await generateSchedule(scheduleId);

        // Count the number of filled shifts
        const filled = shifts.filter((s) => s.assignedEmployeeId).length;

        // Count the number of unfilled shifts
        const unfilled = shifts.length - filled;

        // Return the success message
        return {
          type: action.type,
          success: true,
          message: `Generated ${shifts.length} shifts (${filled} filled, ${unfilled} unfilled)`,
        };
      } catch (err: unknown) {
        // Return the error message
        const msg = err instanceof Error ? err.message : "Generation failed";
        return { type: action.type, success: false, message: msg };
      }
    }
    case "replace_employee": {
      const { shiftId } = action as { shiftId: number; type: string };

      // Check if the shift ID is valid
      if (!shiftId) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftId",
        };
      }

      // Replace the employee on the shift
      const shift = await replaceEmployee(shiftId);

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: shift.assignedEmployee
          ? `Replaced with ${shift.assignedEmployee.name} on ${shift.date} ${shift.period}`
          : `Could not find a replacement for ${shift.role} on ${shift.date} ${shift.period}`,
      };
    }
    case "replace_employee_batch": {
      const { shiftIds } = action as { shiftIds: number[]; type: string };

      // Check if the shift IDs are valid
      if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
        return {
          type: action.type,
          success: false,
          message: "Missing or empty shiftIds array",
        };
      }

      // Replace the employees on the shifts
      const shifts = await replaceEmployeeBatch(shiftIds);

      // Count the number of replaced shifts
      const replaced = shifts.filter((s) => s.assignedEmployee).length;

      // Count the number of unfilled shifts
      const unfilled = shifts.length - replaced;

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Processed ${shifts.length} shifts (${replaced} replaced, ${unfilled} unfilled)`,
      };
    }
    case "delete_shifts": {
      const { shiftIds, date, period, role } = action as {
        type: string;
        shiftIds?: number[];
        date?: string;
        period?: string;
        role?: string;
      };

      // Get the shift repository
      const repo = AppDataSource.getRepository(Shift);

      if (shiftIds && shiftIds.length > 0) {
        // Delete the shifts
        await repo.delete(shiftIds);
        // Return the success message
        return {
          type: action.type,
          success: true,
          message: `Deleted ${shiftIds.length} shifts`,
        };
      }

      // Build filter from optional params
      const where: Record<string, unknown> = { scheduleId };
      if (date) where.date = date;
      if (period) where.period = period;
      if (role) where.role = role;

      if (Object.keys(where).length === 1) {
        // Return the error message
        return {
          type: action.type,
          success: false,
          message:
            "Must provide at least one filter (shiftIds, date, period, or role)",
        };
      }

      // Find the shifts
      const shifts = await repo.find({ where });

      // Check if there are any shifts
      if (shifts.length === 0) {
        return {
          type: action.type,
          success: true,
          message: "No shifts matched the filter",
        };
      }

      // Delete the shifts
      await repo.remove(shifts);
      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Deleted ${shifts.length} shifts`,
      };
    }
    case "assign_employee": {
      const { shiftId, employeeId } = action as {
        type: string;
        shiftId: number;
        employeeId: number;
      };

      // Check if the shift ID or employee ID is valid
      if (!shiftId || !employeeId) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftId or employeeId",
        };
      }

      // Get the shift and employee repositories
      const shiftRepo = AppDataSource.getRepository(Shift);
      const empRepo = AppDataSource.getRepository(Employee);

      // Find the shift
      const shift = await shiftRepo.findOne({ where: { id: shiftId } });
      if (!shift) {
        return {
          type: action.type,
          success: false,
          message: `Shift ${shiftId} not found`,
        };
      }

      // Find the employee
      const employee = await empRepo.findOne({ where: { id: employeeId } });
      if (!employee) {
        return {
          type: action.type,
          success: false,
          message: `Employee ${employeeId} not found`,
        };
      }

      // Validate role match
      if (employee.role !== shift.role) {
        return {
          type: action.type,
          success: false,
          message: `Cannot assign ${employee.name} (${employee.role}) to a ${shift.role} shift`,
        };
      }

      // Assign the employee to the shift
      shift.assignedEmployeeId = employeeId;
      shift.assignedEmployee = employee;
      await shiftRepo.save(shift);

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Assigned ${employee.name} to ${shift.date} ${shift.period} (${shift.role})`,
      };
    }
    case "unassign_employee": {
      const { shiftIds } = action as { type: string; shiftIds: number[] };

      // Check if the shift IDs are valid
      if (!shiftIds || !Array.isArray(shiftIds) || shiftIds.length === 0) {
        return {
          type: action.type,
          success: false,
          message: "Missing or empty shiftIds array",
        };
      }

      // Get the shift repository
      const repo = AppDataSource.getRepository(Shift);
      let unassigned = 0;

      // Iterate through the shift IDs
      for (const id of shiftIds) {
        // Find the shift
        const shift = await repo.findOne({ where: { id } });
        if (shift && shift.assignedEmployeeId) {
          // Unassign the employee from the shift
          shift.assignedEmployeeId = null;
          shift.assignedEmployee = null;
          await repo.save(shift);

          // Count the number of unassigned shifts
          unassigned++;
        }
      }

      // Return the success message
      return {
        type: action.type,
        success: true,
        message: `Unassigned ${unassigned} of ${shiftIds.length} shifts`,
      };
    }
    case "swap_employees": {
      const { shiftIdA, shiftIdB } = action as {
        type: string;
        shiftIdA: number;
        shiftIdB: number;
      };

      if (!shiftIdA || !shiftIdB) {
        return {
          type: action.type,
          success: false,
          message: "Missing shiftIdA or shiftIdB",
        };
      }

      try {
        const [a, b] = await swapEmployees(shiftIdA, shiftIdB);
        const nameA = a.assignedEmployee?.name || "unfilled";
        const nameB = b.assignedEmployee?.name || "unfilled";
        return {
          type: action.type,
          success: true,
          message: `Swapped: shift ${shiftIdA} now has ${nameA}, shift ${shiftIdB} now has ${nameB}`,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Swap failed";
        return { type: action.type, success: false, message: msg };
      }
    }
    default:
      // Return the error message
      return {
        type: action.type,
        success: false,
        message: `Unknown action: ${action.type}`,
      };
  }
}
