import type { SearchHit } from "@localchat/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchLocal } from "../../api/client";
import { RecentConversationsList } from "../search/SearchPage";
import { SearchSnippet } from "../search/SearchSnippet";
import { Button } from "./Primitives";
import type { Conversation } from "@localchat/shared";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  query: string;
  items: CommandItem[];
  recentConversations: Conversation[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSearchNavigate: (hit: SearchHit) => void;
  onSelectConversation: (conversation: Conversation) => void;
}

type PaletteRow =
  | { kind: "command"; item: CommandItem }
  | { kind: "search"; hit: SearchHit };

export function CommandPalette({
  open,
  query,
  items,
  recentConversations,
  onQueryChange,
  onClose,
  onSearchNavigate,
  onSelectConversation,
}: CommandPaletteProps) {
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();
  const isSearchMode = trimmedQuery.length > 0;

  const filteredCommands = useMemo(
    () =>
      items.filter((item) =>
        item.label.toLowerCase().includes(trimmedQuery.toLowerCase()),
      ),
    [items, trimmedQuery],
  );

  const rows: PaletteRow[] = useMemo(() => {
    if (isSearchMode) {
      return searchHits.map((hit) => ({ kind: "search" as const, hit }));
    }
    return filteredCommands.map((item) => ({ kind: "command" as const, item }));
  }, [filteredCommands, isSearchMode, searchHits]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [open, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [rows.length, isSearchMode]);

  useEffect(() => {
    if (!open || !isSearchMode) {
      setSearchHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const result = await searchLocal({ q: trimmedQuery, limit: 20 });
          setSearchHits(result.hits);
        } catch {
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, isSearchMode, trimmedQuery]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, Math.max(rows.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === "Enter" && rows[activeIndex]) {
        event.preventDefault();
        const row = rows[activeIndex]!;
        if (row.kind === "command") {
          row.item.action();
          onClose();
        } else {
          onSearchNavigate(row.hit);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, rows, activeIndex, onSearchNavigate]);

  if (!open) {
    return null;
  }

  const groups = filteredCommands.reduce<Record<string, CommandItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group]!.push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="drawer-backdrop absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border-subtle bg-elevated shadow-overlay motion-standard">
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search commands or local content…"
          aria-label="Command palette search"
          className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Command palette results">
          {!isSearchMode ? (
            <>
              <RecentConversationsList
                conversations={recentConversations}
                onSelect={(conversation) => {
                  onSelectConversation(conversation);
                  onClose();
                }}
              />
              {Object.keys(groups).length === 0 ? (
                <p className="px-3 py-6 text-sm text-secondary">No commands found.</p>
              ) : (
                Object.entries(groups).map(([group, groupItems]) => (
                  <div key={group} className="mb-3">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                      {group}
                    </p>
                    <ul>
                      {groupItems.map((item) => {
                        const index = rows.findIndex(
                          (row) => row.kind === "command" && row.item.id === item.id,
                        );
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={index === activeIndex}
                              onClick={() => {
                                item.action();
                                onClose();
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                                index === activeIndex
                                  ? "bg-accent/15 text-primary"
                                  : "text-primary hover:bg-muted"
                              }`}
                            >
                              <span>{item.label}</span>
                              {item.hint ? (
                                <span className="text-xs text-secondary">{item.hint}</span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </>
          ) : searchLoading ? (
            <p className="px-3 py-6 text-sm text-secondary">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-secondary">No local results found.</p>
          ) : (
            <ul>
              {rows.map((row, index) =>
                row.kind === "search" ? (
                  <li key={`${row.hit.entityType}-${row.hit.entityId}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onClick={() => {
                        onSearchNavigate(row.hit);
                        onClose();
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left ${
                        index === activeIndex ? "bg-accent/15" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-primary">{row.hit.title}</span>
                        <span className="text-[10px] uppercase tracking-wide text-secondary">
                          {row.hit.entityType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        <SearchSnippet parts={row.hit.snippetParts} />
                      </p>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-xs text-secondary">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Esc
          </Button>
        </div>
      </div>
    </div>
  );
}
