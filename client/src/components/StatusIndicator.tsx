import type { OllamaStatus } from "@localchat/shared";

interface StatusIndicatorProps {
  status: OllamaStatus | null;
  loading: boolean;
  requireEmbedding?: boolean;
}

function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "neutral" }) {
  const colors = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-secondary",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[tone]}`}
      aria-hidden="true"
    />
  );
}

export function StatusIndicator({
  status,
  loading,
  requireEmbedding = false,
}: StatusIndicatorProps) {
  if (loading && !status) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-secondary">
        <StatusDot tone="neutral" />
        Checking Ollama…
      </span>
    );
  }

  if (!status?.online) {
    return (
      <span
        className="inline-flex items-center gap-2 text-sm text-danger"
        title={status?.error}
      >
        <StatusDot tone="danger" />
        Ollama offline
      </span>
    );
  }

  if (!status.selectedModelAvailable) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-warning">
        <StatusDot tone="warning" />
        Chat model missing
      </span>
    );
  }

  if (requireEmbedding && !status.embeddingModelAvailable) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-warning">
        <StatusDot tone="warning" />
        Embedding model missing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm text-success">
      <StatusDot tone="success" />
      Ollama ready
    </span>
  );
}
