import type { Conversation, SearchEntityType, SearchHit } from "@localchat/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { searchLocal } from "../../api/client";
import { Badge, Button, EmptyState } from "../ui/Primitives";
import { SearchSnippet } from "./SearchSnippet";

interface SearchPageProps {
  models: string[];
  onNavigate: (hit: SearchHit) => void;
}

const TYPE_OPTIONS: SearchEntityType[] = ["conversation", "message", "prompt"];

export function SearchPage({ models, onNavigate }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<SearchEntityType[]>([...TYPE_OPTIONS]);
  const [role, setRole] = useState("");
  const [model, setModel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasCitations, setHasCitations] = useState<"" | "true" | "false">("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useMemo(
    () => ({
      q: query.trim(),
      types: types.join(","),
      role: role || undefined,
      model: model || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      hasCitations: hasCitations || undefined,
      limit: 50,
    }),
    [query, types, role, model, from, to, hasCitations],
  );

  const runSearch = useCallback(async () => {
    if (!searchParams.q) {
      setHits([]);
      setTotal(0);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await searchLocal(searchParams);
      setHits(result.hits);
      setTotal(result.total);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setHits([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  const clearFilters = () => {
    setTypes([...TYPE_OPTIONS]);
    setRole("");
    setModel("");
    setFrom("");
    setTo("");
    setHasCitations("");
  };

  const hasFilters =
    types.length !== TYPE_OPTIONS.length ||
    role ||
    model ||
    from ||
    to ||
    hasCitations;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary">Search</h1>
        <p className="mt-1 text-sm text-secondary">
          Full-text search across conversations, messages, and prompt templates.
        </p>
      </header>

      <label className="block">
        <span className="sr-only">Search query</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search locally…"
          aria-label="Search query"
          className="w-full rounded-xl border border-border-subtle bg-muted px-4 py-3 text-primary outline-none ring-accent focus:ring-2"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_OPTIONS.map((type) => {
          const active = types.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setTypes((current) =>
                  current.includes(type)
                    ? current.filter((entry) => entry !== type)
                    : [...current, type],
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active ? "bg-accent text-accent-text" : "bg-muted text-secondary"
              }`}
            >
              {type}
            </button>
          );
        })}
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-lg border border-border-subtle bg-muted px-3 py-1 text-sm"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
          <option value="system">System</option>
        </select>
        <select
          aria-label="Filter by model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="rounded-lg border border-border-subtle bg-muted px-3 py-1 text-sm"
        >
          <option value="">All models</option>
          {models.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by citations"
          value={hasCitations}
          onChange={(event) => setHasCitations(event.target.value as "" | "true" | "false")}
          className="rounded-lg border border-border-subtle bg-muted px-3 py-1 text-sm"
        >
          <option value="">Any citations</option>
          <option value="true">With citations</option>
          <option value="false">Without citations</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded-lg border border-border-subtle bg-muted px-3 py-1 text-sm"
        />
        <input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded-lg border border-border-subtle bg-muted px-3 py-1 text-sm"
        />
        {hasFilters ? (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div aria-live="polite" className="text-sm text-secondary">
        {loading ? "Searching…" : query.trim() ? `${total} result${total === 1 ? "" : "s"}` : "Enter a query to search"}
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!loading && !error && query.trim() && hits.length === 0 ? (
        <EmptyState
          title="No results"
          description="Try different keywords or clear some filters."
        />
      ) : null}

      {!query.trim() ? (
        <EmptyState
          title="Search your local workspace"
          description="Find conversations, messages, and prompt templates without sending data off-device."
        />
      ) : null}

      <ul className="space-y-2 overflow-y-auto pb-8">
        {hits.map((hit) => (
          <li key={`${hit.entityType}-${hit.entityId}`}>
            <button
              type="button"
              onClick={() => onNavigate(hit)}
              className="w-full rounded-xl border border-border-subtle bg-elevated px-4 py-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-primary">
                  {hit.entityType === "message"
                    ? hit.conversationTitle ?? hit.title
                    : hit.title}
                </span>
                <Badge tone="neutral">{hit.entityType}</Badge>
                {hit.role ? <Badge tone="info">{hit.role}</Badge> : null}
                {hit.model ? <Badge tone="neutral">{hit.model}</Badge> : null}
                {hit.hasCitation ? <Badge tone="success">Sources</Badge> : null}
                <span className="ml-auto text-xs text-secondary">
                  {new Date(hit.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-secondary">
                <SearchSnippet parts={hit.snippetParts} />
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecentConversationsList({
  conversations,
  onSelect,
}: {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
}) {
  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary">
        Recent conversations
      </p>
      <ul>
        {conversations.slice(0, 8).map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span>{conversation.title}</span>
              <span className="text-xs text-secondary">{conversation.model}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
