import type { OllamaStatus } from "@localchat/shared";

interface StatusIndicatorProps {
  status: OllamaStatus | null;
  loading: boolean;
}

export function StatusIndicator({ status, loading }: StatusIndicatorProps) {
  if (loading && !status) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-400">
        <span className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
        Checking Ollama…
      </span>
    );
  }

  if (!status?.online) {
    return (
      <span
        className="inline-flex items-center gap-2 text-sm text-red-300"
        title={status?.error}
      >
        <span className="h-2 w-2 rounded-full bg-red-400" />
        Ollama offline
      </span>
    );
  }

  if (!status.selectedModelAvailable) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Model missing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      Ollama ready
    </span>
  );
}
