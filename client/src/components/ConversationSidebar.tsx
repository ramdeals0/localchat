import type { Conversation } from "@localchat/shared";
import { useMemo, useState } from "react";
import {
  groupConversationsByDate,
  usePinnedConversations,
} from "../hooks/useWorkspace";
import { Badge, Button, IconButton, Skeleton } from "./ui/Primitives";

export type WorkspaceView = "chat" | "knowledge" | "prompts" | "search";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  activeView: WorkspaceView;
  loading?: boolean;
  onViewChange: (view: WorkspaceView) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  activeView,
  loading = false,
  onViewChange,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState("");
  const { pinnedIds, togglePin } = usePinnedConversations();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(query) ||
        conversation.model.toLowerCase().includes(query),
    );
  }, [conversations, search]);

  const pinned = filtered.filter((conversation) =>
    pinnedIds.includes(conversation.id),
  );
  const unpinned = filtered.filter(
    (conversation) => !pinnedIds.includes(conversation.id),
  );
  const grouped = groupConversationsByDate(unpinned);

  const renderConversation = (conversation: Conversation) => {
    const active = conversation.id === activeId && activeView === "chat";
    return (
      <li key={conversation.id} className="group px-2">
        <div
          className={`motion-standard rounded-xl border px-3 py-3 ${
            active
              ? "border-accent/30 bg-accent-muted"
              : "border-transparent hover:border-border-subtle hover:bg-muted"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              onViewChange("chat");
              onSelect(conversation.id);
            }}
            className="w-full text-left"
          >
            <div className="flex items-center gap-2">
              {pinnedIds.includes(conversation.id) ? (
                <span aria-label="Pinned" title="Pinned">
                  📌
                </span>
              ) : null}
              <span className="truncate text-sm font-medium text-primary">
                {conversation.title}
              </span>
            </div>
            <div className="mt-1 truncate text-xs text-secondary">
              {conversation.model}
            </div>
          </button>
          <div className="mt-2 hidden gap-2 group-hover:flex group-focus-within:flex">
            <button
              type="button"
              className="text-xs text-secondary hover:text-primary"
              onClick={() => togglePin(conversation.id)}
            >
              {pinnedIds.includes(conversation.id) ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              className="text-xs text-secondary hover:text-primary"
              onClick={() => {
                const next = window.prompt("Rename conversation", conversation.title);
                if (next?.trim()) {
                  onRename(conversation.id, next.trim());
                }
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="text-xs text-danger hover:opacity-80"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${conversation.title}"? This cannot be undone.`,
                  )
                ) {
                  onDelete(conversation.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-subtle px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">LocalChat</h1>
            <p className="text-xs text-secondary">Offline AI workspace</p>
          </div>
          <Badge tone="accent">Local</Badge>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={activeView === "chat" ? "primary" : "secondary"}
            onClick={() => onViewChange("chat")}
          >
            Chat
          </Button>
          <Button
            size="sm"
            variant={activeView === "search" ? "primary" : "secondary"}
            onClick={() => onViewChange("search")}
          >
            Search
          </Button>
          <Button
            size="sm"
            variant={activeView === "knowledge" ? "primary" : "secondary"}
            onClick={() => onViewChange("knowledge")}
          >
            Knowledge
          </Button>
          <Button
            size="sm"
            variant={activeView === "prompts" ? "primary" : "secondary"}
            onClick={() => onViewChange("prompts")}
          >
            Prompts
          </Button>
        </div>
        <Button className="w-full" onClick={onCreate}>
          New Chat
        </Button>
      </div>

      <div className="border-b border-border-subtle px-4 py-3">
        <label className="sr-only" htmlFor="conversation-search">
          Search conversations
        </label>
        <input
          id="conversation-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conversations"
          className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2 text-sm text-primary placeholder:text-secondary"
        />
      </div>

      <nav aria-label="Conversation history" className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="space-y-3 px-4 py-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-secondary">
            No conversations yet. Start a new chat to begin.
          </p>
        ) : (
          <>
            {pinned.length > 0 ? (
              <section className="mb-4">
                <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  Pinned
                </h2>
                <ul className="space-y-1">{pinned.map(renderConversation)}</ul>
              </section>
            ) : null}
            {grouped.map((group) => (
              <section key={group.label} className="mb-4">
                <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  {group.label}
                </h2>
                <ul className="space-y-1">{group.items.map(renderConversation)}</ul>
              </section>
            ))}
          </>
        )}
      </nav>
    </div>
  );
}
