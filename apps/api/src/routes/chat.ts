import { Router } from "express";
import { handleChatMessage } from "../services/ai-chat";

const router = Router();

router.post("/", async (req, res) => {
  const { message, history = [], scheduleId } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!scheduleId) {
    return res.status(400).json({ error: "scheduleId is required" });
  }

  try {
    const result = await handleChatMessage(message, history, scheduleId);
    res.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Chat processing failed";
    console.error("Chat error:", errorMessage);

    if (errorMessage.includes("API key") || errorMessage.includes("OPENAI_API_KEY")) {
      return res.json({
        reply: "OpenAI API key is not configured. Please set OPENAI_API_KEY in apps/api/.env to enable AI chat.",
        actions: [],
      });
    }

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
