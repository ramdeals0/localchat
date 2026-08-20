import type { MessageCitation } from "@localchat/shared";
import { SafeMarkdown } from "./SafeMarkdown";
import { formatCitationLabel, highlightQueryTerms } from "../api/client";

interface SourcePreviewPanelProps {
  citation: MessageCitation;
  query?: string;
  onClose: () => void;
}

export function SourcePreviewPanel({
  citation,
  query = "",
  onClose,
}: SourcePreviewPanelProps) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-surface-border bg-[#0b1220] p-5 shadow-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Source preview</h3>
          <p className="text-sm text-gray-400">{formatCitationLabel(citation)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-surface-border px-3 py-1 text-sm text-gray-300 hover:bg-surface-raised"
        >
          Close
        </button>
      </div>

      <dl className="mb-4 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Filename</dt>
          <dd className="text-gray-100">{citation.originalName}</dd>
        </div>
        {citation.pageNumber !== null && (
          <div>
            <dt className="text-gray-500">Page</dt>
            <dd className="text-gray-100">{citation.pageNumber}</dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">Chunk</dt>
          <dd className="text-gray-100">{citation.chunkIndex}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Similarity</dt>
          <dd className="text-gray-100">{citation.similarity.toFixed(3)}</dd>
        </div>
      </dl>

      <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
        <SafeMarkdown
          content={highlightQueryTerms(citation.content, query)}
          className="markdown-body max-w-none text-sm leading-6 text-gray-100"
        />
      </div>
    </aside>
  );
}
