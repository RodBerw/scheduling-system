/**
 * Chat routes.
 * Mounts the AI-powered chat endpoint under the /chat prefix.
 */
import { Router } from "express";
import * as chatController from "../controllers/chatController";

const router = Router();

router.post("/", chatController.chat);

export default router;
