"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSendChatMessage } from "@/hooks/use-chat";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { TypingIndicator } from "@/components/typing-indicator";

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

interface ChatMessageWithId extends ChatMessageType {
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatMutation = useSendChatMessage(scheduleId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const focusInput = useCallback(() => {
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Chat message"]')?.focus(), 50);
  }, []);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || chatMutation.isPending) return;

    const userMsg: ChatMessageWithId = { id: nextMsgId(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await chatMutation.mutateAsync({ message: msg, history });
      setMessages((prev) => [...prev, { id: nextMsgId(), role: "assistant", content: res.reply }]);
      if (res.actions?.length > 0) {
        onScheduleChange();
      }
    } catch {
      toast.error("AI request failed. Please try again.");
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      focusInput();
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm" id="chat-heading">AI Assistant</h2>
          <p className="text-[11px] text-muted-foreground">Ask anything about the schedule</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" role="log" aria-labelledby="chat-heading">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {chatMutation.isPending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="text-[11px] px-2.5 py-1.5 rounded-full border hover:bg-primary/5 hover:border-primary/30 transition-colors text-muted-foreground flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              {s}
            </button>
          ))}
        </div>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => handleSend()}
        disabled={chatMutation.isPending}
      />
    </div>
  );
}
