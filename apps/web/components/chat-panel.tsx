"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSendChatMessage } from "@/hooks/use-chat";
import type { ChatMessage } from "@/lib/types";
import { Send, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatMutation = useSendChatMessage(scheduleId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-2 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 last:mb-0">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <code className="block bg-background/50 rounded-md p-2 my-2 text-xs overflow-x-auto">{children}</code>
                      ) : (
                        <code className="bg-background/50 rounded px-1 py-0.5 text-xs">{children}</code>
                      );
                    },
                    pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-2 last:mb-0">
                        <table className="min-w-full text-xs border-collapse">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => <th className="border border-border/50 px-2 py-1 font-semibold text-left bg-background/30">{children}</th>,
                    td: ({ children }) => <td className="border border-border/50 px-2 py-1">{children}</td>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
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
              className="text-[11px] px-2.5 py-1.5 rounded-full border hover:bg-primary/5 hover:border-primary/30 transition-colors text-muted-foreground flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
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
            disabled={chatMutation.isPending}
            rows={1}
            aria-label="Chat message"
            className="flex-1 bg-transparent resize-none text-sm outline-none py-1.5 max-h-20 placeholder:text-muted-foreground/60"
          />
          <Button
            onClick={() => handleSend()}
            disabled={chatMutation.isPending || !input.trim()}
            size="sm"
            className="rounded-lg h-8 w-8 p-0 shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
