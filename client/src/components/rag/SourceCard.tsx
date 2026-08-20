import type { MessageCitation } from "@localchat/shared";
import { formatCitationLabel, highlightQueryTerms } from "../../api/client";
import { SafeMarkdown } from "../SafeMarkdown";
import { Badge } from "../ui/Primitives";

interface SourceCardProps {
  citation: MessageCitation;
  query?: string;
  active?: boolean;
  onSelect: () => void;
}

export function SourceCard({
  citation,
  query = "",
  active = false,
  onSelect,
}: SourceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`motion-standard w-full rounded-xl border p-4 text-left ${
        active
          ? "border-accent/40 bg-accent-muted"
          : "border-border-subtle bg-elevated hover:bg-muted"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="truncate text-sm font-medium text-primary">
          {citation.originalName}
        </p>
        <Badge tone="neutral">
          {citation.pageNumber !== null ? `p.${citation.pageNumber}` : "no page"}
        </Badge>
        <Badge tone="accent">chunk {citation.chunkIndex}</Badge>
      </div>
      <p className="mb-2 text-xs text-secondary">
        {formatCitationLabel(citation)} · similarity {citation.similarity.toFixed(2)}
      </p>
      <div className="line-clamp-4 text-sm text-secondary">
        <SafeMarkdown
          content={highlightQueryTerms(citation.content, query)}
          className="markdown-body"
        />
      </div>
    </button>
  );
}

export function ContextPanel({
  citations,
  activeCitation,
  query,
  noRelevantSources,
  onSelectCitation,
  privacyPanel,
  settingsPanel,
  backupPanel,
  mode,
}: {
  citations: MessageCitation[];
  activeCitation: MessageCitation | null;
  query: string;
  noRelevantSources: boolean;
  onSelectCitation: (citation: MessageCitation) => void;
  privacyPanel: React.ReactNode;
  settingsPanel: React.ReactNode;
  backupPanel?: React.ReactNode;
  mode: "sources" | "privacy" | "settings" | "backup";
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">
          {mode === "sources"
            ? "Retrieved sources"
            : mode === "privacy"
              ? "Privacy & status"
              : mode === "backup"
                ? "Backup & import"
                : "Conversation settings"}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {mode === "privacy" ? privacyPanel : null}
        {mode === "settings" ? settingsPanel : null}
        {mode === "backup" ? backupPanel : null}
        {mode === "sources" ? (
          citations.length === 0 ? (
            <p className="text-sm text-secondary">
              {noRelevantSources
                ? "No relevant local sources found for the latest response."
                : "Sources from grounded responses will appear here."}
            </p>
          ) : (
            <div className="space-y-3">
              {citations.map((citation) => (
                <SourceCard
                  key={citation.id}
                  citation={citation}
                  query={query}
                  active={activeCitation?.id === citation.id}
                  onSelect={() => onSelectCitation(citation)}
                />
              ))}
              {activeCitation ? (
                <div className="rounded-xl border border-border-subtle bg-muted p-4">
                  <h3 className="mb-2 text-sm font-medium text-primary">
                    Source preview
                  </h3>
                  <SafeMarkdown
                    content={highlightQueryTerms(activeCitation.content, query)}
                    className="markdown-body text-sm"
                  />
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
