/**
 * Employee routes.
 * Mounts the employee listing endpoint under the /employees prefix.
 */
import { Router } from "express";
import * as employeeController from "../controllers/employeeController";

const router = Router();

router.get("/", employeeController.list);

export default router;
