/**
 * Chat controller.
 * Handles HTTP request/response logic for the AI chat endpoint.
 * Delegates message processing to the ai-chat service.
 */
import { Request, Response } from "express";
import { handleChatMessage } from "../services/ai-chat";

/** POST /chat — Send a message to the AI assistant and receive a response with optional actions */
export async function chat(req: Request, res: Response) {
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
    const errorMessage =
      err instanceof Error ? err.message : "Chat processing failed";
    console.error(
      "Chat error:",
      err instanceof Error ? { message: err.message, stack: err.stack } : err
    );

    // Return a friendly message instead of 500 when the API key is missing
    if (
      errorMessage.includes("API key") ||
      errorMessage.includes("OPENAI_API_KEY")
    ) {
      return res.json({
        reply:
          "OpenAI API key is not configured. Please set OPENAI_API_KEY in apps/api/.env to enable AI chat.",
        actions: [],
      });
    }

    res.status(500).json({ error: errorMessage });
  }
}
