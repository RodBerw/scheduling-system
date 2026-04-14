import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          role === "user"
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        {role === "assistant" ? (
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
            {content}
          </ReactMarkdown>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </div>
    </div>
  );
}
