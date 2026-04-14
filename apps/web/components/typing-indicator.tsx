export function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
