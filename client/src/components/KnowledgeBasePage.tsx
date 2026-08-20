import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DocumentRecord, DocumentSearchHit } from "@localchat/shared";
import {
  deleteDocument,
  listDocumentChunks,
  listDocuments,
  reindexDocument,
  searchDocuments,
  uploadDocuments,
} from "../api/client";
import { IndexingProgress } from "./IndexingProgress";
import { SearchSnippet } from "./search/SearchSnippet";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColor(status: DocumentRecord["status"]): string {
  switch (status) {
    case "ready":
      return "text-emerald-300";
    case "processing":
      return "text-sky-300";
    case "failed":
      return "text-red-300";
    default:
      return "text-amber-300";
  }
}

type DocumentSearchScope = "all" | "selected";

export function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [contentQuery, setContentQuery] = useState("");
  const [searchScope, setSearchScope] = useState<DocumentSearchScope>("all");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [contentHits, setContentHits] = useState<DocumentSearchHit[]>([]);
  const [contentTotal, setContentTotal] = useState(0);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChunks, setSelectedChunks] = useState<string | null>(null);
  const [chunkPreview, setChunkPreview] = useState<
    Awaited<ReturnType<typeof listDocumentChunks>>
  >([]);
  const [analyzeDocument, setAnalyzeDocument] = useState<DocumentRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const items = await listDocuments(nameFilter);
      setDocuments(items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load documents",
      );
    } finally {
      setLoading(false);
    }
  }, [nameFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status === "ready"),
    [documents],
  );

  const readyCount = readyDocuments.length;

  const activeIndexing = useMemo(
    () =>
      documents.some(
        (document) => document.status === "queued" || document.status === "processing",
      ),
    [documents],
  );

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      if (activeIndexing) {
        void loadDocuments();
      }
    }, activeIndexing ? 1000 : 3000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [activeIndexing, loadDocuments]);

  useEffect(() => {
    if (!contentQuery.trim()) {
      setContentHits([]);
      setContentTotal(0);
      setContentError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setContentLoading(true);
        setContentError(null);
        try {
          const result = await searchDocuments({
            q: contentQuery.trim(),
            documentIds:
              searchScope === "selected" && selectedDocumentIds.length > 0
                ? selectedDocumentIds
                : undefined,
            limit: 30,
          });
          setContentHits(result.hits);
          setContentTotal(result.total);
        } catch (searchError) {
          setContentError(
            searchError instanceof Error ? searchError.message : "Document search failed",
          );
          setContentHits([]);
          setContentTotal(0);
        } finally {
          setContentLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [contentQuery, searchScope, selectedDocumentIds]);

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await uploadDocuments(list);
      if (result.errors.length > 0) {
        setError(
          result.errors
            .map((entry) => `${entry.filename}: ${entry.error}`)
            .join(" | "),
        );
      }
      await loadDocuments();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document: DocumentRecord) => {
    if (
      !window.confirm(
        `Delete "${document.originalName}" and all indexed chunks?`,
      )
    ) {
      return;
    }
    await deleteDocument(document.id);
    setSelectedDocumentIds((current) => current.filter((id) => id !== document.id));
    await loadDocuments();
  };

  const handleReindex = async (document: DocumentRecord) => {
    await reindexDocument(document.id);
    await loadDocuments();
  };

  const handleViewChunks = async (document: DocumentRecord) => {
    const chunks = await listDocumentChunks(document.id);
    setAnalyzeDocument(null);
    setSelectedChunks(document.originalName);
    setChunkPreview(chunks);
  };

  const handleAnalyzeDocument = async (document: DocumentRecord) => {
    const chunks = await listDocumentChunks(document.id);
    setSelectedChunks(null);
    setAnalyzeDocument(document);
    setSelectedDocumentIds([document.id]);
    setSearchScope("selected");
    setChunkPreview(chunks);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-surface-border px-5 py-4">
        <h2 className="text-lg font-semibold">Knowledge Base</h2>
        <p className="text-sm text-gray-400">
          Import local documents for offline retrieval. {readyCount} ready.
          {activeIndexing ? " Indexing in progress…" : ""}
        </p>
      </header>

      <section className="border-b border-surface-border px-5 py-4">
        <div
          className="rounded-xl border border-dashed border-surface-border bg-surface-raised p-8 text-center"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <p className="mb-3 text-sm text-gray-300">
            Drag and drop up to 10 files (txt, md, pdf, docx, csv, json) — max 25 MB each
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Choose files"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.docx,.csv,.json"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                void handleFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
        </div>
      </section>

      <section className="space-y-3 border-b border-surface-border px-5 py-4">
        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="document-name-filter">
            Filter uploaded files by name
          </label>
          <input
            id="document-name-filter"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Filter by filename"
            className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-300" htmlFor="document-content-search">
            Search indexed document content
          </label>
          <input
            id="document-content-search"
            value={contentQuery}
            onChange={(event) => setContentQuery(event.target.value)}
            placeholder="Search uploaded and indexed chunks only…"
            aria-label="Search indexed document content"
            className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-400">Scope:</span>
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="document-search-scope"
              checked={searchScope === "all"}
              onChange={() => setSearchScope("all")}
            />
            All ready documents
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="document-search-scope"
              checked={searchScope === "selected"}
              onChange={() => setSearchScope("selected")}
            />
            Selected documents only
          </label>
        </div>

        {contentLoading ? (
          <p className="text-sm text-gray-400">Searching indexed chunks…</p>
        ) : null}
        {contentError ? (
          <p className="text-sm text-red-300">{contentError}</p>
        ) : null}
        {contentQuery.trim() && !contentLoading && !contentError ? (
          <p className="text-sm text-gray-400">
            {contentTotal} chunk result{contentTotal === 1 ? "" : "s"}
          </p>
        ) : null}

        {contentHits.length > 0 ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {contentHits.map((hit) => (
              <li
                key={hit.chunkId}
                className="rounded-lg border border-surface-border bg-surface-raised p-3 text-sm"
              >
                <header className="mb-1 text-xs text-gray-400">
                  {hit.originalName} · chunk {hit.chunkIndex}
                  {hit.pageNumber !== null ? ` · page ${hit.pageNumber}` : ""}
                </header>
                <p className="text-gray-200">
                  <SearchSnippet parts={hit.snippetParts} />
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {error && (
        <div className="border-b border-red-900 bg-red-950/40 px-5 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <p className="text-gray-400">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-400">
            No documents imported yet. Add local files to enable grounded answers.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Chunks</th>
                  <th className="px-3 py-2">Imported</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className="border-t border-surface-border text-gray-200"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${document.originalName}`}
                        disabled={document.status !== "ready"}
                        checked={selectedDocumentIds.includes(document.id)}
                        onChange={() => toggleDocumentSelection(document.id)}
                      />
                    </td>
                    <td className="px-3 py-3">{document.originalName}</td>
                    <td className="px-3 py-3">{document.mimeType ?? "unknown"}</td>
                    <td className="px-3 py-3">{formatBytes(document.fileSize)}</td>
                    <td className={`px-3 py-3 ${statusColor(document.status)}`}>
                      <div className="capitalize">{document.status}</div>
                      <IndexingProgress document={document} />
                      {document.errorMessage ? (
                        <div className="mt-1 text-xs text-red-300">
                          {document.errorMessage}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{document.chunkCount}</td>
                    <td className="px-3 py-3">
                      {new Date(document.importedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAnalyzeDocument(document)}
                          disabled={document.status !== "ready"}
                          className="text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Analyze
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleViewChunks(document)}
                          className="text-sky-300 hover:text-sky-200"
                        >
                          Chunks
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReindex(document)}
                          disabled={
                            document.status === "queued" ||
                            document.status === "processing"
                          }
                          className="text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Re-index
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(document)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {analyzeDocument ? (
        <section className="border-t border-surface-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">
                Analyze {analyzeDocument.originalName}
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Source snippets from your uploaded document. Use Prompt Library → Analyze local
                documents for an AI summary grounded in these excerpts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnalyzeDocument(null);
                setChunkPreview([]);
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {chunkPreview.length === 0 ? (
              <p className="text-sm text-gray-400">No indexed chunks available yet.</p>
            ) : (
              chunkPreview.map((chunk) => (
                <article
                  key={chunk.id}
                  className="rounded-lg border border-surface-border bg-surface-raised p-3 text-sm"
                >
                  <header className="mb-2 text-xs text-gray-500">
                    Snippet · chunk {chunk.chunkIndex}
                    {chunk.pageNumber !== null ? ` · page ${chunk.pageNumber}` : ""}
                  </header>
                  <p className="whitespace-pre-wrap text-gray-200">{chunk.content}</p>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {selectedChunks && !analyzeDocument ? (
        <section className="border-t border-surface-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-white">
              Chunks for {selectedChunks}
            </h3>
            <button
              type="button"
              onClick={() => {
                setSelectedChunks(null);
                setChunkPreview([]);
              }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {chunkPreview.map((chunk) => (
              <article
                key={chunk.id}
                className="rounded-lg border border-surface-border bg-surface-raised p-3 text-sm"
              >
                <header className="mb-2 text-xs text-gray-500">
                  Chunk {chunk.chunkIndex}
                  {chunk.pageNumber !== null ? ` · page ${chunk.pageNumber}` : ""}
                </header>
                <p className="whitespace-pre-wrap text-gray-200">{chunk.content}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
