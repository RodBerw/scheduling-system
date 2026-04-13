import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entities/Employee";

const router = Router();

router.get("/", async (req, res) => {
  const repo = AppDataSource.getRepository(Employee);
  const { role } = req.query;

  const where = role ? { role: role as string } : {};
  const employees = await repo.find({ where });

  res.json(employees);
});

export default router;
