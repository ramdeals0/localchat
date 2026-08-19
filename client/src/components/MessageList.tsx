import type { Message } from "@localchat/shared";
import { SafeMarkdown } from "./SafeMarkdown";

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
}: MessageListProps) {
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Send a message to start chatting locally with Ollama.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <article
          key={message.id}
          className={`rounded-xl border px-4 py-3 ${
            message.role === "user"
              ? "border-sky-800 bg-sky-950/40"
              : "border-surface-border bg-surface-raised"
          }`}
        >
          <header className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {message.role === "user" ? "You" : "Assistant"}
          </header>
          {message.role === "assistant" ? (
            <SafeMarkdown
              content={message.content}
              className="markdown-body prose-invert max-w-none text-sm leading-6"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          )}
        </article>
      ))}

      {isStreaming && (
        <article className="rounded-xl border border-surface-border bg-surface-raised px-4 py-3">
          <header className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Assistant
          </header>
          <SafeMarkdown
            content={streamingContent || "…"}
            className="markdown-body prose-invert max-w-none text-sm leading-6"
          />
        </article>
      )}
    </div>
  );
}
