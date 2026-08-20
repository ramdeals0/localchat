import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button, IconButton } from "./ui/Primitives";

const PROMPT_SUGGESTIONS = [
  "Summarize my local documents in plain language.",
  "What can you help me with offline?",
  "Draft a checklist from my imported notes.",
];

const SLASH_COMMANDS = [
  { command: "/clear", label: "Clear conversation" },
  { command: "/export", label: "Export conversation as Markdown" },
  { command: "/docs", label: "Open Knowledge Base" },
  { command: "/prompt", label: "Insert prompt template" },
  { command: "/regenerate", label: "Regenerate latest response" },
  { command: "/help", label: "Show available commands" },
];

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  showSuggestions?: boolean;
  onSuggestionSelect?: (value: string) => void;
  onSlashCommand?: (command: string) => void;
  onAttach?: () => void;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  showSuggestions = false,
  onSuggestionSelect,
  onSlashCommand,
  onAttach,
  placeholder,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [value]);

  const slashMatches = useMemo(() => {
    if (!value.startsWith("/")) {
      return [];
    }
    return SLASH_COMMANDS.filter((entry) =>
      entry.command.startsWith(value.split(/\s/)[0] ?? ""),
    );
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !isStreaming && value.trim()) {
        onSubmit();
      }
    }
    if (event.key === "/" && value.length === 0) {
      setMenuOpen(true);
    }
  };

  return (
    <div className="sticky bottom-0 border-t border-border-subtle bg-base/90 px-4 py-4 backdrop-blur">
      <div className="mx-auto max-w-4xl">
        {showSuggestions ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionSelect?.(suggestion)}
                className="motion-standard rounded-full border border-border-subtle bg-elevated px-3 py-1.5 text-sm text-secondary hover:bg-muted hover:text-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative rounded-2xl border border-border-subtle bg-[var(--color-bg-composer)] p-3 shadow-panel">
          {menuOpen && slashMatches.length > 0 ? (
            <div className="mb-2 rounded-xl border border-border-subtle bg-elevated p-2">
              {slashMatches.map((entry) => (
                <button
                  key={entry.command}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onSlashCommand?.(entry.command);
                    setMenuOpen(false);
                    onChange("");
                  }}
                >
                  <span className="font-medium text-primary">{entry.command}</span>
                  <span className="text-secondary">{entry.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setMenuOpen(event.target.value.startsWith("/"));
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled || isStreaming}
            aria-label="Message composer"
            placeholder={placeholder}
            className="max-h-60 w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-primary outline-none placeholder:text-secondary"
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <IconButton label="Attach document" onClick={() => onAttach?.()}>
                📎
              </IconButton>
              <span className="hidden text-xs text-secondary sm:inline">
                Enter to send · Shift+Enter for newline · / for commands
              </span>
            </div>
            {isStreaming ? (
              <Button variant="danger" onClick={onStop}>
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={disabled || !value.trim()}
                onClick={onSubmit}
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
