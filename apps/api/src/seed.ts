import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Employee } from "./entities/Employee";
import { Schedule } from "./entities/Schedule";
import { ScheduleRequirement } from "./entities/ScheduleRequirement";
import { Shift } from "./entities/Shift";
import { generateSchedule } from "./services/scheduler";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("Seed script cannot run in production. Set NODE_ENV to something else.");
    process.exit(1);
  }

  await AppDataSource.initialize();
  console.log("Database connected, seeding...");

  // Clear existing data
  await AppDataSource.getRepository(Shift).clear();
  await AppDataSource.getRepository(ScheduleRequirement).clear();
  await AppDataSource.getRepository(Schedule).clear();
  await AppDataSource.getRepository(Employee).clear();

  // --- Employees ---
  const employeeRepo = AppDataSource.getRepository(Employee);

  const employees: Partial<Employee>[] = [
    // Managers (3)
    { name: "James Wilson", role: "manager", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Sarah Mitchell", role: "manager", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Robert Clark", role: "manager", maxHoursPerWeek: 24, availability: JSON.stringify([4,5,6,0]) },

    // Cooks (6)
    { name: "Michael Thompson", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "David Rodriguez", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Emily Parker", role: "cook", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Daniel Harris", role: "cook", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Jessica Turner", role: "cook", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Chris Martinez", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },

    // Waiters (8)
    { name: "Ashley Cooper", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Brandon Lee", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Megan Scott", role: "waiter", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Tyler Morgan", role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Lauren Adams", role: "waiter", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Nathan Brooks", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },
    { name: "Olivia Reed", role: "waiter", maxHoursPerWeek: 20, availability: JSON.stringify([5,6]) },
    { name: "Ryan Bennett", role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3]) },

    // Dishwashers (5)
    { name: "Kevin Foster", role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Amanda Hughes", role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Jason Price", role: "dishwasher", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Stephanie Ward", role: "dishwasher", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Trevor Coleman", role: "dishwasher", maxHoursPerWeek: 20, availability: JSON.stringify([3,4,5]) },
  ];

  await employeeRepo.save(employees.map((e) => employeeRepo.create(e)));
  console.log(`Seeded ${employees.length} employees`);

  // --- Schedules ---
  const scheduleRepo = AppDataSource.getRepository(Schedule);
  const reqRepo = AppDataSource.getRepository(ScheduleRequirement);

  // Helper to compute date ranges
  const now = new Date();
  const day = now.getDay();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - ((day + 6) % 7));

  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(base.getDate() + days);
    return d;
  };

  // ============================================================
  // Schedule 1 — "Quiet Midweek" (Complexity 1)
  //   3 days (Wed–Fri), minimal staffing, pre-filled with shifts
  // ============================================================
  const s1Start = addDays(thisMonday, 2); // Wednesday
  const s1End = addDays(thisMonday, 4);   // Friday

  const schedule1 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Quiet Midweek", startDate: fmt(s1Start), endDate: fmt(s1End) }),
  );
  console.log(`Created schedule: "${schedule1.name}" (${schedule1.startDate} to ${schedule1.endDate})`);

  type ReqTemplate = { role: "manager" | "cook" | "waiter" | "dishwasher"; morning: number; afternoon: number; evening: number };

  const s1Reqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 1 },
    { role: "cook",       morning: 1, afternoon: 1, evening: 1 },
    { role: "waiter",     morning: 1, afternoon: 1, evening: 2 },
    { role: "dishwasher", morning: 1, afternoon: 1, evening: 1 },
  ];

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 3; dayOfWeek <= 5; dayOfWeek++) { // Wed(3), Thu(4), Fri(5)
      for (const req of s1Reqs) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({ dayOfWeek, role: req.role, period, requiredCount: req[period], scheduleId: schedule1.id });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule1.name}"`);
  }

  const s1Shifts = await generateSchedule(schedule1.id);
  const s1Filled = s1Shifts.filter((s) => s.assignedEmployeeId).length;
  console.log(`  Generated ${s1Shifts.length} shifts (${s1Filled} filled, ${s1Shifts.length - s1Filled} unfilled)`);

  // ============================================================
  // Schedule 2 — "Full Week" (Complexity 2)
  //   7 days (Mon–Sun), moderate staffing with weekend bump,
  //   pre-filled with shifts
  // ============================================================
  const s2Start = addDays(thisMonday, 7);  // Next Monday
  const s2End = addDays(thisMonday, 13);   // Next Sunday

  const schedule2 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Full Week", startDate: fmt(s2Start), endDate: fmt(s2End) }),
  );
  console.log(`Created schedule: "${schedule2.name}" (${schedule2.startDate} to ${schedule2.endDate})`);

  const weekdayReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 1 },
    { role: "cook",       morning: 2, afternoon: 2, evening: 3 },
    { role: "waiter",     morning: 2, afternoon: 3, evening: 3 },
    { role: "dishwasher", morning: 1, afternoon: 1, evening: 2 },
  ];

  const weekendReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 1 },
    { role: "cook",       morning: 2, afternoon: 3, evening: 4 },
    { role: "waiter",     morning: 3, afternoon: 4, evening: 5 },
    { role: "dishwasher", morning: 1, afternoon: 2, evening: 2 },
  ];

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const template = isWeekend ? weekendReqs : weekdayReqs;
      for (const req of template) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({ dayOfWeek, role: req.role, period, requiredCount: req[period], scheduleId: schedule2.id });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule2.name}"`);
  }

  const s2Shifts = await generateSchedule(schedule2.id);
  const s2Filled = s2Shifts.filter((s) => s.assignedEmployeeId).length;
  console.log(`  Generated ${s2Shifts.length} shifts (${s2Filled} filled, ${s2Shifts.length - s2Filled} unfilled)`);

  // ============================================================
  // Schedule 3 — "To Plan Week" (Complexity 2)
  //   7 days (Mon–Sun), same moderate staffing,
  //   requirements set but NO shifts generated (ready to fill via chat)
  // ============================================================
  const s3Start = addDays(thisMonday, 14); // Two weeks out (Monday)
  const s3End = addDays(thisMonday, 20);   // Two weeks out (Sunday)

  const schedule3 = await scheduleRepo.save(
    scheduleRepo.create({ name: "To Plan Week", startDate: fmt(s3Start), endDate: fmt(s3End) }),
  );
  console.log(`Created schedule: "${schedule3.name}" (${schedule3.startDate} to ${schedule3.endDate})`);

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const template = isWeekend ? weekendReqs : weekdayReqs;
      for (const req of template) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({ dayOfWeek, role: req.role, period, requiredCount: req[period], scheduleId: schedule3.id });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule3.name}"`);
  }

  console.log(`  No shifts generated — ready to fill via chat`);

  // ============================================================
  // Schedule 4 — "Holiday Rush" (Complexity 3)
  //   14 days, high staffing demands across all periods,
  //   pre-filled — expect some unfilled shifts due to staff limits
  // ============================================================
  const s4Start = addDays(thisMonday, 21); // Three weeks out (Monday)
  const s4End = addDays(thisMonday, 34);   // Two weeks later (Sunday)

  const schedule4 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Holiday Rush", startDate: fmt(s4Start), endDate: fmt(s4End) }),
  );
  console.log(`Created schedule: "${schedule4.name}" (${schedule4.startDate} to ${schedule4.endDate})`);

  const rushWeekdayReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 2 },
    { role: "cook",       morning: 3, afternoon: 3, evening: 4 },
    { role: "waiter",     morning: 3, afternoon: 4, evening: 5 },
    { role: "dishwasher", morning: 2, afternoon: 2, evening: 3 },
  ];

  const rushWeekendReqs: ReqTemplate[] = [
    { role: "manager",    morning: 2, afternoon: 2, evening: 2 },
    { role: "cook",       morning: 4, afternoon: 4, evening: 5 },
    { role: "waiter",     morning: 4, afternoon: 5, evening: 6 },
    { role: "dishwasher", morning: 2, afternoon: 3, evening: 3 },
  ];

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const template = isWeekend ? rushWeekendReqs : rushWeekdayReqs;
      for (const req of template) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({ dayOfWeek, role: req.role, period, requiredCount: req[period], scheduleId: schedule4.id });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule4.name}"`);
  }

  const s4Shifts = await generateSchedule(schedule4.id);
  const s4Filled = s4Shifts.filter((s) => s.assignedEmployeeId).length;
  console.log(`  Generated ${s4Shifts.length} shifts (${s4Filled} filled, ${s4Shifts.length - s4Filled} unfilled)`);

  await AppDataSource.destroy();
  console.log("\nSeed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
