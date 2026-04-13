/**
 * Shift routes.
 * Mounts endpoints for querying, generating, replacing, and assigning shifts
 * under the /shifts prefix.
 */
import { Router } from "express";
import * as shiftController from "../controllers/shiftController";

const router = Router();

router.get("/", shiftController.list);
router.post("/generate", shiftController.generate);
router.post("/replace", shiftController.replace);
router.post("/assign", shiftController.assign);
router.get("/eligible/:shiftId", shiftController.eligible);

export default router;
