import { Router } from "express";
import { handleChatMessage } from "../services/ai-chat";

const router = Router();

router.post("/", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const result = await handleChatMessage(message, history);
    res.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Chat processing failed";
    console.error("Chat error:", errorMessage);

    // If OpenAI key is missing, return a helpful message
    if (errorMessage.includes("API key")) {
      return res.json({
        reply: "OpenAI API key is not configured. Please set OPENAI_API_KEY in apps/api/.env to enable AI chat.",
        actions: [],
      });
    }

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
