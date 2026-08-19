interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
  placeholder?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder,
}: ChatComposerProps) {
  return (
    <div className="border-t border-surface-border bg-[#0b1220] p-4">
      <div className="flex gap-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!disabled && !isStreaming && value.trim()) {
                onSubmit();
              }
            }
          }}
          rows={3}
          disabled={disabled || isStreaming}
          placeholder={placeholder}
          className="min-h-[88px] flex-1 resize-y rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-gray-100 outline-none focus:border-accent"
        />
        <div className="flex w-28 flex-col gap-2">
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-black enabled:hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
