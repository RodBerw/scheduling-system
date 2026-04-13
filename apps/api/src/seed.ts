import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Employee } from "./entities/Employee";
import { ScheduleRequirement } from "./entities/ScheduleRequirement";
import { Shift } from "./entities/Shift";

async function seed() {
  await AppDataSource.initialize();
  console.log("Database connected, seeding...");

  // Clear existing data
  await AppDataSource.getRepository(Shift).clear();
  await AppDataSource.getRepository(ScheduleRequirement).clear();
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

  // --- Schedule Requirements ---
  const reqRepo = AppDataSource.getRepository(ScheduleRequirement);

  type ReqTemplate = { role: Employee["role"]; morning: number; afternoon: number; evening: number };

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

  const requirements: Partial<ScheduleRequirement>[] = [];

  for (let day = 0; day <= 6; day++) {
    const isWeekend = day === 0 || day === 5 || day === 6; // Sun, Fri, Sat
    const template = isWeekend ? weekendReqs : weekdayReqs;

    for (const req of template) {
      for (const period of ["morning", "afternoon", "evening"] as const) {
        requirements.push({
          dayOfWeek: day,
          role: req.role,
          period,
          requiredCount: req[period],
        });
      }
    }
  }

  await reqRepo.save(requirements.map((r) => reqRepo.create(r)));
  console.log(`Seeded ${requirements.length} schedule requirements`);

  await AppDataSource.destroy();
  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
