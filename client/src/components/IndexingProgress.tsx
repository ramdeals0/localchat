import type { DocumentIndexStage, DocumentRecord } from "@localchat/shared";

export function getIndexingProgressLabel(document: DocumentRecord): string {
  if (document.status === "queued") {
    return "Waiting to start…";
  }
  if (document.status !== "processing") {
    return "";
  }

  switch (document.indexStage) {
    case "extracting":
      return "Extracting text…";
    case "chunking":
      return "Creating chunks…";
    case "embedding":
      if (document.indexProgressTotal > 0) {
        return `Embedding chunk ${document.indexProgressCurrent} of ${document.indexProgressTotal}`;
      }
      return "Generating embeddings…";
    case "saving":
      return "Saving index…";
    default:
      return "Indexing…";
  }
}

export function getIndexingProgressPercent(document: DocumentRecord): number | null {
  if (document.status === "queued") {
    return null;
  }
  if (document.status !== "processing") {
    return null;
  }
  if (document.indexStage === "embedding" && document.indexProgressTotal > 0) {
    return Math.round(
      (document.indexProgressCurrent / document.indexProgressTotal) * 100,
    );
  }
  if (document.indexStage === "saving") {
    return 100;
  }
  if (document.indexStage === "extracting") {
    return 10;
  }
  if (document.indexStage === "chunking") {
    return 25;
  }
  return null;
}

interface IndexingProgressProps {
  document: DocumentRecord;
}

export function IndexingProgress({ document }: IndexingProgressProps) {
  const isActive = document.status === "queued" || document.status === "processing";
  if (!isActive) {
    return null;
  }

  const label = getIndexingProgressLabel(document);
  const percent = getIndexingProgressPercent(document);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-secondary">
        <span>{label}</span>
        {percent !== null ? <span>{percent}%</span> : null}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={label}
      >
        {percent !== null ? (
          <div
            className="h-full rounded-full bg-accent transition-all duration-standard"
            style={{ width: `${Math.max(percent, 4)}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent/70" />
        )}
      </div>
    </div>
  );
}
