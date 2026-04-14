"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-3 border-t">
      <div className="flex items-end gap-2 bg-muted/50 rounded-xl px-3 py-1.5 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/50 transition-all">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          aria-label="Chat message"
          className="flex-1 bg-transparent resize-none text-sm outline-none py-1.5 max-h-20 placeholder:text-muted-foreground/60"
        />
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size="sm"
          className="rounded-lg h-8 w-8 p-0 shrink-0 cursor-pointer"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
