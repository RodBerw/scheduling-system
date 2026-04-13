/**
 * Schedule routes.
 * Mounts CRUD endpoints for schedules and their staffing requirements
 * under the /schedules prefix.
 */
import { Router } from "express";
import * as scheduleController from "../controllers/scheduleController";

const router = Router();

router.get("/", scheduleController.list);
router.post("/", scheduleController.create);
router.get("/:id", scheduleController.getById);
router.delete("/:id", scheduleController.remove);
router.get("/:id/requirements", scheduleController.getRequirements);
router.post("/:id/requirements", scheduleController.setRequirements);

export default router;
