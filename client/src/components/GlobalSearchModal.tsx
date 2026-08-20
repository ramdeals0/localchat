import type { SearchHit } from "@localchat/shared";
import { useEffect, useState } from "react";
import { highlightQueryTerms, searchLocal } from "../api/client";
import { Button } from "./ui/Primitives";
import { SafeMarkdown } from "./SafeMarkdown";

interface GlobalSearchModalProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onNavigate: (hit: SearchHit) => void;
}

export function GlobalSearchModal({
  open,
  initialQuery = "",
  onClose,
  onNavigate,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await searchLocal({ q: query.trim(), limit: 30 });
          setHits(result.hits);
        } catch (searchError) {
          setError(searchError instanceof Error ? searchError.message : "Search failed");
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <button
        type="button"
        aria-label="Close search"
        className="drawer-backdrop absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-border-subtle bg-elevated shadow-overlay">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations, messages, and prompts…"
          className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-primary outline-none placeholder:text-secondary"
        />
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {loading ? <p className="px-3 py-4 text-sm text-secondary">Searching…</p> : null}
          {error ? <p className="px-3 py-4 text-sm text-danger">{error}</p> : null}
          {!loading && !error && query.trim() && hits.length === 0 ? (
            <p className="px-3 py-4 text-sm text-secondary">No results found.</p>
          ) : null}
          <ul className="space-y-1">
            {hits.map((hit) => (
              <li key={`${hit.entityType}-${hit.entityId}`}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(hit);
                    onClose();
                  }}
                  className="w-full rounded-lg px-3 py-3 text-left hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-primary">{hit.title}</span>
                    <span className="text-[10px] uppercase tracking-wide text-secondary">
                      {hit.entityType}
                      {hit.role ? ` · ${hit.role}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-secondary">
                    <SafeMarkdown content={highlightQueryTerms(hit.snippet, query)} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-xs text-secondary">
          <span>Ctrl/Cmd+Shift+F opens direct search</span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Esc
          </Button>
        </div>
      </div>
    </div>
  );
}
