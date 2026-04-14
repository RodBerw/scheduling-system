import { describe, it, expect } from "vitest";
import {
  getWeekBounds,
  eachDate,
  countWeeklyHours,
  findEligibleEmployees,
} from "../src/services/scheduler";
import type { Employee } from "../src/entities/Employee";
import type { Shift } from "../src/entities/Shift";

/** Minimal fake employee for testing (no DB needed). */
function emp(
  overrides: Partial<Employee> & {
    id: number;
    role: string;
    availability: string;
  }
): Employee {
  return { name: "Test", maxHoursPerWeek: 40, ...overrides } as Employee;
}

/** Minimal fake shift for testing (no DB needed). */
function shift(overrides: Partial<Shift>): Shift {
  return { id: 0, period: "morning", role: "cook", ...overrides } as Shift;
}

describe("date helpers", () => {
  it("getWeekBounds returns Monday–Sunday for any day of the week", () => {
    // Wednesday 2026-04-22
    expect(getWeekBounds("2026-04-22")).toEqual({
      weekStart: "2026-04-20",
      weekEnd: "2026-04-26",
    });
    // Monday (start of week)
    expect(getWeekBounds("2026-04-20")).toEqual({
      weekStart: "2026-04-20",
      weekEnd: "2026-04-26",
    });
    // Sunday (end of week)
    expect(getWeekBounds("2026-04-26")).toEqual({
      weekStart: "2026-04-20",
      weekEnd: "2026-04-26",
    });
  });

  it("eachDate generates inclusive date range", () => {
    expect(eachDate("2026-04-20", "2026-04-22")).toEqual([
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
    ]);
    expect(eachDate("2026-04-20", "2026-04-20")).toEqual(["2026-04-20"]);
  });
});

describe("countWeeklyHours", () => {
  it("counts only shifts for the given employee within the week range", () => {
    const shifts = [
      shift({ assignedEmployeeId: 1, date: "2026-04-20" }),
      shift({ assignedEmployeeId: 1, date: "2026-04-21" }),
      shift({ assignedEmployeeId: 2, date: "2026-04-20" }), // different employee
      shift({ assignedEmployeeId: 1, date: "2026-04-27" }), // outside range
    ];

    // 4h per shift × 2 shifts in range = 8h
    expect(countWeeklyHours(shifts, 1, "2026-04-20", "2026-04-26")).toBe(8);
    expect(countWeeklyHours(shifts, 2, "2026-04-20", "2026-04-26")).toBe(4);
    expect(countWeeklyHours(shifts, 3, "2026-04-20", "2026-04-26")).toBe(0);
  });
});

describe("findEligibleEmployees", () => {
  const monday = "2026-04-20"; // dayOfWeek = 1

  it("filters by role, availability, hour limit, and sorts by fewest hours", () => {
    const alice = emp({
      id: 1,
      name: "Alice",
      role: "cook",
      availability: "[1,2,3]",
      maxHoursPerWeek: 40,
    });
    const bob = emp({
      id: 2,
      name: "Bob",
      role: "cook",
      availability: "[1,2,3]",
      maxHoursPerWeek: 40,
    });
    const carol = emp({
      id: 3,
      name: "Carol",
      role: "waiter",
      availability: "[1,2,3]",
    }); // wrong role
    const dave = emp({
      id: 4,
      name: "Dave",
      role: "cook",
      availability: "[2,3]",
    }); // not available Monday

    // Bob already has 1 shift this week, Alice has 0
    const existing = [shift({ assignedEmployeeId: 2, date: "2026-04-21" })];

    const result = findEligibleEmployees([alice, bob, carol, dave], existing, {
      role: "cook",
      date: monday,
      period: "morning",
      weekStart: "2026-04-20",
      weekEnd: "2026-04-26",
    });

    // Carol excluded (waiter), Dave excluded (not available Monday)
    // Alice first (0h) then Bob (4h) — greedy sort
    expect(result.map((e) => e.name)).toEqual(["Alice", "Bob"]);
  });

  it("excludes employees over weekly hour limit and already assigned to same slot", () => {
    const alice = emp({
      id: 1,
      name: "Alice",
      role: "cook",
      availability: "[1]",
      maxHoursPerWeek: 4,
    });
    const bob = emp({
      id: 2,
      name: "Bob",
      role: "cook",
      availability: "[1]",
      maxHoursPerWeek: 40,
    });

    const existing = [
      shift({ assignedEmployeeId: 1, date: "2026-04-20", period: "afternoon" }), // Alice already at 4h (limit)
      shift({ assignedEmployeeId: 2, date: monday, period: "morning" }), // Bob already in this slot
    ];

    const result = findEligibleEmployees([alice, bob], existing, {
      role: "cook",
      date: monday,
      period: "morning",
      weekStart: "2026-04-20",
      weekEnd: "2026-04-26",
    });

    // Alice over limit, Bob already assigned to same date+period → nobody eligible
    expect(result).toEqual([]);
  });
});
