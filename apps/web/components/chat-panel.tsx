"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { sendChatMessage } from "@/services/chatService";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  scheduleId: number;
  onScheduleChange: () => void;
}

const SUGGESTIONS = [
  "Set requirements: 2 cooks, 3 waiters, 1 manager each shift",
  "Add 4 cooks on weekend evenings",
  "Generate the schedule",
  "Replace Maria on Friday evening",
];

let msgIdCounter = 0;
function nextMsgId() {
  return `msg-${++msgIdCounter}`;
}

interface ChatMessageWithId extends ChatMessage {
  id: string;
}

export function ChatPanel({ scheduleId, onScheduleChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageWithId[]>([
    {
      id: nextMsgId(),
      role: "assistant",
      content:
        "Hi! I can help you manage schedules. Try asking me to generate a schedule, replace someone, or check availability.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMsg: ChatMessageWithId = { id: nextMsgId(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage(msg, history, scheduleId);
      setMessages((prev) => [...prev, { id: nextMsgId(), role: "assistant", content: res.reply }]);
      if (res.actions?.length > 0) {
        onScheduleChange();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm" id="chat-heading">AI Assistant</h2>
        <p className="text-xs text-muted-foreground">Ask anything about the schedule</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" role="log" aria-labelledby="chat-heading">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              }`}
            >
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border hover:bg-muted transition-colors text-muted-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            rows={1}
            aria-label="Chat message"
            className="flex-1 bg-transparent resize-none text-sm outline-none py-1.5 max-h-20 placeholder:text-muted-foreground/60"
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            size="sm"
            className="rounded-lg h-7 px-2.5 text-xs"
            aria-label="Send message"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
