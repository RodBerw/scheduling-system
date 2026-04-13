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
    { name: "Carlos Silva", role: "manager", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Ana Oliveira", role: "manager", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Roberto Lima", role: "manager", maxHoursPerWeek: 24, availability: JSON.stringify([4,5,6,0]) },

    // Cooks (6)
    { name: "Maria Santos", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "João Pereira", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Fernanda Costa", role: "cook", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Pedro Almeida", role: "cook", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Lucia Ferreira", role: "cook", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Diego Mendes", role: "cook", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },

    // Waiters (8)
    { name: "Camila Rocha", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Bruno Souza", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Juliana Ribeiro", role: "waiter", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Marcos Gomes", role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Patricia Dias", role: "waiter", maxHoursPerWeek: 36, availability: JSON.stringify([0,1,2,3,4]) },
    { name: "Thiago Martins", role: "waiter", maxHoursPerWeek: 40, availability: JSON.stringify([2,3,4,5,6]) },
    { name: "Isabela Araujo", role: "waiter", maxHoursPerWeek: 20, availability: JSON.stringify([5,6]) },
    { name: "Rafael Barbosa", role: "waiter", maxHoursPerWeek: 32, availability: JSON.stringify([0,1,2,3]) },

    // Dishwashers (5)
    { name: "Lucas Carvalho", role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([1,2,3,4,5]) },
    { name: "Amanda Nascimento", role: "dishwasher", maxHoursPerWeek: 40, availability: JSON.stringify([0,1,2,3,4,5,6]) },
    { name: "Felipe Moreira", role: "dishwasher", maxHoursPerWeek: 24, availability: JSON.stringify([5,6,0]) },
    { name: "Gabriela Teixeira", role: "dishwasher", maxHoursPerWeek: 32, availability: JSON.stringify([1,2,3,4,5,6]) },
    { name: "Vinicius Cardoso", role: "dishwasher", maxHoursPerWeek: 20, availability: JSON.stringify([3,4,5]) },
  ];

  await employeeRepo.save(employees.map((e) => employeeRepo.create(e)));
  console.log(`Seeded ${employees.length} employees`);

  // --- Schedules ---
  const scheduleRepo = AppDataSource.getRepository(Schedule);
  const reqRepo = AppDataSource.getRepository(ScheduleRequirement);

  // Helper to get week dates
  const now = new Date();
  const day = now.getDay();
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - ((day + 6) % 7));
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Schedule 1: This week (with requirements + shifts filled)
  const schedule1 = await scheduleRepo.save(
    scheduleRepo.create({
      name: "This Week",
      startDate: fmt(thisMonday),
      endDate: fmt(thisSunday),
    }),
  );
  console.log(`Created schedule: "${schedule1.name}" (${schedule1.startDate} to ${schedule1.endDate})`);

  // Schedule 2: Next week (with requirements, no shifts yet)
  const schedule2 = await scheduleRepo.save(
    scheduleRepo.create({
      name: "Next Week",
      startDate: fmt(nextMonday),
      endDate: fmt(nextSunday),
    }),
  );
  console.log(`Created schedule: "${schedule2.name}" (${schedule2.startDate} to ${schedule2.endDate})`);

  // --- Requirements ---
  type ReqTemplate = { role: "manager" | "cook" | "waiter" | "dishwasher"; morning: number; afternoon: number; evening: number };

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

  // Add requirements to both schedules
  for (const schedule of [schedule1, schedule2]) {
    const requirements: Partial<ScheduleRequirement>[] = [];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const template = isWeekend ? weekendReqs : weekdayReqs;
      for (const req of template) {
        for (const period of ["morning", "afternoon", "evening"] as const) {
          requirements.push({
            dayOfWeek,
            role: req.role,
            period,
            requiredCount: req[period],
            scheduleId: schedule.id,
          });
        }
      }
    }
    await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
    console.log(`  Added ${requirements.length} requirements to "${schedule.name}"`);
  }

  // Generate shifts for schedule 1 only
  const shifts = await generateSchedule(schedule1.id);
  const filled = shifts.filter((s) => s.assignedEmployeeId).length;
  console.log(`  Generated ${shifts.length} shifts for "${schedule1.name}" (${filled} filled, ${shifts.length - filled} unfilled)`);

  await AppDataSource.destroy();
  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
