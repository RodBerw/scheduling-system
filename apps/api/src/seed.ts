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
  // A diverse roster of 38 employees designed to showcase the scheduler:
  //   - Full-timers with broad availability (the "backbone")
  //   - Part-timers with narrow availability (stress the greedy selector)
  //   - Weekend-only workers (demonstrate weekend-bump coverage)
  //   - Weekday-only workers (demonstrate role-splitting by day type)
  //   - Varied max-hours (shows how the load-balancer distributes work)
  // Availability encoding: 0=Sunday, 1=Monday, ... 6=Saturday
  const employeeRepo = AppDataSource.getRepository(Employee);

  const employees: Partial<Employee>[] = [
    // ============================================================
    // Managers (4) — always enough for 1/period/day with redundancy
    // ============================================================
    { name: "James Wilson",     role: "manager", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Sarah Mitchell",   role: "manager", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Robert Clark",     role: "manager", maxHoursPerWeek: 24, availability: JSON.stringify([4,5,6,0]) },
    { name: "Patricia Nguyen",  role: "manager", maxHoursPerWeek: 36, availability: JSON.stringify([2,3,4,5,6]) },

    // ============================================================
    // Cooks (10) — the tightest role, needs depth for swaps
    // ============================================================
    { name: "Michael Thompson", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "David Rodriguez",  role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Emily Parker",     role: "cook", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Daniel Harris",    role: "cook", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Jessica Turner",   role: "cook", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Chris Martinez",   role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },
    { name: "Hiroshi Tanaka",   role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) }, // head cook, flexible
    { name: "Sofia Martinez",   role: "cook", maxHoursPerWeek: 20, availability: JSON.stringify([5,6]) },           // weekend-only
    { name: "Marcus Johnson",   role: "cook", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4]) },       // weekday-only
    { name: "Priya Patel",      role: "cook", maxHoursPerWeek: 28, availability: JSON.stringify([3,4,5,6,0]) },     // late-week + weekend

    // ============================================================
    // Waiters (14) — highest-demand role, biggest pool
    // ============================================================
    { name: "Ashley Cooper",    role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Brandon Lee",      role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Megan Scott",      role: "waiter", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Tyler Morgan",     role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Lauren Adams",     role: "waiter", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Nathan Brooks",    role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },
    { name: "Olivia Reed",      role: "waiter", maxHoursPerWeek: 20, availability: JSON.stringify([5,6]) },
    { name: "Ryan Bennett",     role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3]) },
    { name: "Isabella Rossi",   role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) }, // full-time backbone
    { name: "Ethan Kim",        role: "waiter", maxHoursPerWeek: 20, availability: JSON.stringify([5,6,0]) },         // Fri-Sun
    { name: "Fatima Al-Hassan", role: "waiter", maxHoursPerWeek: 28, availability: JSON.stringify([2,3,4,5,6]) },
    { name: "Lucas Silva",      role: "waiter", maxHoursPerWeek: 24, availability: JSON.stringify([1,2,3]) },         // Mon-Wed only
    { name: "Zoe Williams",     role: "waiter", maxHoursPerWeek: 36, availability: JSON.stringify([3,4,5,6,0]) },
    { name: "Marcus Green",     role: "waiter", maxHoursPerWeek: 16, availability: JSON.stringify([6,0]) },           // student — Sat/Sun

    // ============================================================
    // Dishwashers (8) — supporting role, flexible coverage
    // ============================================================
    { name: "Kevin Foster",     role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Amanda Hughes",    role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Jason Price",      role: "dishwasher", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Stephanie Ward",   role: "dishwasher", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Trevor Coleman",   role: "dishwasher", maxHoursPerWeek: 20, availability: JSON.stringify([3,4,5]) },
    { name: "Omar Hassan",      role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Grace Kim",        role: "dishwasher", maxHoursPerWeek: 20, availability: JSON.stringify([5,6]) },
    { name: "Carlos Mendes",    role: "dishwasher", maxHoursPerWeek: 32, availability: JSON.stringify([3,4,5,6,0]) },
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

  type ReqTemplate = { role: "manager" | "cook" | "waiter" | "dishwasher"; morning: number; afternoon: number; evening: number };

  // ============================================================
  // Schedule 1 — "Full Week"
  //   7 days (Mon–Sun) next week. Moderate staffing with weekend
  //   bump. Pre-filled via auto-generation so the reviewer has
  //   something to explore/tweak immediately on first open.
  // ============================================================
  const s1Start = addDays(thisMonday, 7);  // Next Monday
  const s1End = addDays(thisMonday, 13);   // Next Sunday

  const schedule1 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Full Week", startDate: fmt(s1Start), endDate: fmt(s1End) }),
  );
  console.log(`Created schedule: "${schedule1.name}" (${schedule1.startDate} to ${schedule1.endDate})`);

  const s1WeekdayReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 1 },
    { role: "cook",       morning: 2, afternoon: 2, evening: 3 },
    { role: "waiter",     morning: 2, afternoon: 3, evening: 3 },
    { role: "dishwasher", morning: 1, afternoon: 1, evening: 2 },
  ];

  const s1WeekendReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 1 },
    { role: "cook",       morning: 2, afternoon: 3, evening: 4 },
    { role: "waiter",     morning: 3, afternoon: 4, evening: 5 },
    { role: "dishwasher", morning: 1, afternoon: 2, evening: 2 },
  ];

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const template = isWeekend ? s1WeekendReqs : s1WeekdayReqs;
      for (const req of template) {
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
  // Schedule 2 — "Empty Week"
  //   7 days (Mon–Sun), no requirements, no shifts.
  //   A blank slate to build entirely via AI chat — showcases the
  //   full end-to-end flow: set requirements -> generate -> tweak.
  // ============================================================
  const s2Start = addDays(thisMonday, 14); // Two weeks out (Monday)
  const s2End = addDays(thisMonday, 20);   // Two weeks out (Sunday)

  const schedule2 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Empty Week", startDate: fmt(s2Start), endDate: fmt(s2End) }),
  );
  console.log(`Created schedule: "${schedule2.name}" (${schedule2.startDate} to ${schedule2.endDate})`);
  console.log(`  No requirements or shifts — build from scratch via chat`);

  // ============================================================
  // Schedule 3 — "Peak Weekend"
  //   4 days (Thu–Sun), elevated staffing for a busy event weekend.
  //   Requirements are intentionally aggressive on cooks/waiters to
  //   stress the scheduler and likely leave a few UNFILLED slots —
  //   giving the reviewer a realistic problem to solve via chat
  //   ("who can cover Saturday evening?", "swap someone's shift", etc.).
  // ============================================================
  const s3Start = addDays(thisMonday, 24); // Three weeks out (Thursday)
  const s3End = addDays(thisMonday, 27);   // Three weeks out (Sunday)

  const schedule3 = await scheduleRepo.save(
    scheduleRepo.create({ name: "Peak Weekend", startDate: fmt(s3Start), endDate: fmt(s3End) }),
  );
  console.log(`Created schedule: "${schedule3.name}" (${schedule3.startDate} to ${schedule3.endDate})`);

  // Thursday/Friday treated as "pre-weekend" (busy but not peak);
  // Saturday/Sunday are the true peak with heavy evening service.
  const s3ThuFriReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 1, evening: 2 },
    { role: "cook",       morning: 3, afternoon: 3, evening: 5 },
    { role: "waiter",     morning: 3, afternoon: 4, evening: 5 },
    { role: "dishwasher", morning: 1, afternoon: 2, evening: 2 },
  ];

  const s3SatSunReqs: ReqTemplate[] = [
    { role: "manager",    morning: 1, afternoon: 2, evening: 2 },
    { role: "cook",       morning: 3, afternoon: 4, evening: 6 },  // tight — likely some unfilled
    { role: "waiter",     morning: 4, afternoon: 5, evening: 7 },  // tight — demonstrates chat-driven fixes
    { role: "dishwasher", morning: 2, afternoon: 2, evening: 3 },
  ];

  {
    const requirements: Partial<ScheduleRequirement>[] = [];
    // Only seed requirements for the days this schedule actually spans (Thu=4, Fri=5, Sat=6, Sun=0)
    const daySpec: Array<{ dayOfWeek: number; template: ReqTemplate[] }> = [
      { dayOfWeek: 4, template: s3ThuFriReqs }, // Thursday
      { dayOfWeek: 5, template: s3ThuFriReqs }, // Friday
      { dayOfWeek: 6, template: s3SatSunReqs }, // Saturday
      { dayOfWeek: 0, template: s3SatSunReqs }, // Sunday
    ];
    for (const { dayOfWeek, template } of daySpec) {
      for (const req of template) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({ dayOfWeek, role: req.role, period, requiredCount: req[period], scheduleId: schedule3.id });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule3.name}"`);
  }

  const s3Shifts = await generateSchedule(schedule3.id);
  const s3Filled = s3Shifts.filter((s) => s.assignedEmployeeId).length;
  console.log(`  Generated ${s3Shifts.length} shifts (${s3Filled} filled, ${s3Shifts.length - s3Filled} unfilled)`);

  await AppDataSource.destroy();
  console.log("\nSeed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
