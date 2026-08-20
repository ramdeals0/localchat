import type { Message, MessageCitation } from "@localchat/shared";
import { useEffect, useRef, useState } from "react";
import { formatCitationLabel } from "../api/client";
import { SafeMarkdown } from "./SafeMarkdown";
import { IconButton } from "./ui/Primitives";

export interface MessageActions {
  onCopy: (message: Message) => void;
  onEditResend?: (message: Message) => void;
  onRegenerate?: (message: Message) => void;
  onBranch?: (message: Message) => void;
  onExport?: (message: Message) => void;
  onSaveAsPrompt?: (message: Message) => void;
}

interface MessageBubbleProps {
  message: Message;
  query?: string;
  streaming?: boolean;
  errorText?: string;
  highlighted?: boolean;
  citations?: MessageCitation[];
  onCitationClick?: (citation: MessageCitation) => void;
  actions?: MessageActions;
}

export function MessageBubble({
  message,
  query = "",
  streaming = false,
  errorText,
  highlighted = false,
  citations = message.citations ?? [],
  onCitationClick,
  actions,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  const label = isUser ? "You" : isAssistant ? "Assistant" : "System";

  return (
    <article
      id={`message-${message.id}`}
      data-message-id={message.id}
      className={`group relative rounded-2xl border px-5 py-4 ${
        highlighted
          ? "message-search-highlight border-accent/40 bg-accent/10"
          : isUser
          ? "border-info/20 bg-info/5"
          : isSystem || errorText
            ? "border-warning/20 bg-warning/5"
            : "border-border-subtle bg-elevated"
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {label}
          </span>
          {streaming ? (
            <span className="text-xs text-accent-text" aria-live="polite">
              Streaming…
            </span>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-1 opacity-0 transition-opacity duration-standard group-hover:opacity-100 group-focus-within:opacity-100">
            <IconButton label="Copy message" onClick={() => actions.onCopy(message)}>
              ⧉
            </IconButton>
            {isUser && actions.onEditResend ? (
              <IconButton
                label="Edit and resend"
                onClick={() => actions.onEditResend?.(message)}
              >
                ✎
              </IconButton>
            ) : null}
            {isAssistant && actions.onRegenerate ? (
              <IconButton
                label="Regenerate response"
                onClick={() => actions.onRegenerate?.(message)}
              >
                ↻
              </IconButton>
            ) : null}
            {actions.onBranch ? (
              <IconButton label="Branch conversation" onClick={() => actions.onBranch?.(message)}>
                ⎇
              </IconButton>
            ) : null}
            {actions.onExport ? (
              <IconButton label="Export message" onClick={() => actions.onExport?.(message)}>
                ↓
              </IconButton>
            ) : null}
            {actions.onSaveAsPrompt ? (
              <IconButton
                label="Save as prompt template"
                onClick={() => actions.onSaveAsPrompt?.(message)}
              >
                ☆
              </IconButton>
            ) : null}
          </div>
        ) : null}
      </header>

      {errorText ? (
        <p className="text-sm text-danger">{errorText}</p>
      ) : isAssistant || isSystem ? (
        <SafeMarkdown
          content={message.content || (streaming ? "…" : "")}
          className="markdown-body max-w-none"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-7 text-primary">
          {message.content}
        </p>
      )}

      {citations.length > 0 ? (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
            Sources
          </p>
          <ul className="space-y-2">
            {citations.map((citation) => (
              <li key={citation.id}>
                <button
                  type="button"
                  onClick={() => onCitationClick?.(citation)}
                  className="text-left text-sm text-accent-text hover:underline"
                >
                  {formatCitationLabel(citation)} ({citation.similarity.toFixed(2)})
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  streamingCitations?: MessageCitation[];
  noRelevantSources?: boolean;
  lastUserQuery?: string;
  loading?: boolean;
  actions?: MessageActions;
  onCitationClick?: (citation: MessageCitation) => void;
  scrollToMessageId?: string | null;
  highlightMessageId?: string | null;
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  streamingCitations = [],
  noRelevantSources = false,
  lastUserQuery = "",
  loading = false,
  actions,
  onCitationClick,
  scrollToMessageId = null,
  highlightMessageId = null,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const stickToBottomRef = useRef(true);
  const savedScrollRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 96;
      setShowScrollButton(distanceFromBottom > 120);
    };

    container.addEventListener("scroll", onScroll);
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (savedScrollRef.current !== null) {
      container.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
      return;
    }

    if (stickToBottomRef.current || isStreaming) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent, isStreaming, loading]);

  useEffect(() => {
    if (!scrollToMessageId) return;
    const element = document.getElementById(`message-${scrollToMessageId}`);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [scrollToMessageId, messages]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const timer = window.setTimeout(() => {
      // Parent clears highlight after animation window.
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [highlightMessageId]);

  const scrollToLatest = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    stickToBottomRef.current = true;
    setShowScrollButton(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 px-1">
        <div className="h-24 rounded-2xl bg-muted" />
        <div className="h-32 rounded-2xl bg-muted" />
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-1 py-2"
        aria-label="Chat messages"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              query={lastUserQuery}
              highlighted={highlightMessageId === message.id}
              actions={actions}
              onCitationClick={onCitationClick}
            />
          ))}

          {isStreaming ? (
            <>
              <MessageBubble
                message={{
                  id: "streaming",
                  conversationId: "",
                  role: "assistant",
                  content: streamingContent,
                  createdAt: Date.now(),
                }}
                streaming
                citations={streamingCitations}
                onCitationClick={onCitationClick}
              />
              {noRelevantSources ? (
                <p className="text-center text-sm text-secondary">
                  No relevant local sources found
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {showScrollButton ? (
        <button
          type="button"
          onClick={scrollToLatest}
          className="motion-standard absolute bottom-4 right-4 rounded-full border border-border-subtle bg-elevated px-4 py-2 text-sm text-primary shadow-overlay hover:bg-muted"
        >
          Scroll to latest
        </button>
      ) : null}
    </div>
  );
}
