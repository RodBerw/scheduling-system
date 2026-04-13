"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sendChatMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  onScheduleChange: () => void;
}

const EXAMPLE_PROMPTS = [
  "Generate schedule for this week",
  "Create weekend schedule with 3 cooks and 5 waiters",
  "Replace Maria on Monday morning",
  "Show me who's working Friday evening",
];

export function ChatPanel({ onScheduleChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your scheduling assistant. I can help you generate schedules, replace employees, and manage shifts. Try one of the examples below or type your own command!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
      ]);
      if (res.actions && res.actions.length > 0) {
        onScheduleChange();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full border-l">
      <div className="p-3 border-b font-semibold text-sm">Chat Assistant</div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground self-end ml-auto"
                  : "bg-muted self-start"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="bg-muted rounded-lg px-3 py-2 text-sm self-start animate-pulse">
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t space-y-2">
        <div className="flex flex-wrap gap-1">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a command..."
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading} size="sm">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
