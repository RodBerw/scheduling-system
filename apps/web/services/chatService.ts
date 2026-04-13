/**
 * Chat service (frontend).
 * Provides API calls for the AI scheduling assistant chat feature.
 */
import { api } from "./api";
import type { ChatResponse } from "@/lib/types";

/**
 * Sends a message to the AI assistant along with the conversation history
 * and the active schedule ID. Returns the assistant's reply and any
 * scheduling actions that were executed.
 */
export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  scheduleId: number,
): Promise<ChatResponse> {
  const { data } = await api.post("/chat", { message, history, scheduleId });
  return data;
}
