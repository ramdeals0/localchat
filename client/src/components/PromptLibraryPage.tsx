import type { PromptTemplate } from "@localchat/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createPrompt,
  deletePrompt,
  duplicatePrompt,
  listPromptCategories,
  listPrompts,
  listPromptTags,
  updatePrompt,
  usePromptTemplate,
} from "../api/client";
import { PromptEditorModal, type PromptEditorValues } from "./prompts/PromptEditorModal";
import { UseTemplateDialog } from "./prompts/UseTemplateDialog";
import { Button, EmptyState } from "./ui/Primitives";
import { useToast } from "./ui/ToastProvider";

interface PromptLibraryPageProps {
  openPromptId?: string | null;
  onOpenPromptHandled?: () => void;
  onLaunchConversation: (payload: {
    conversationId: string;
    ragEnabled: boolean;
    defaultTemperature: number | null;
  }) => void;
}

export function PromptLibraryPage({
  openPromptId = null,
  onOpenPromptHandled,
  onLaunchConversation,
}: PromptLibraryPageProps) {
  const { pushToast } = useToast();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [usePrompt, setUsePrompt] = useState<PromptTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, categoryItems, tagItems] = await Promise.all([
        listPrompts({
          search: search || undefined,
          category: category || undefined,
          tag: selectedTag || undefined,
          includeArchived: showArchived,
        }),
        listPromptCategories(),
        listPromptTags(),
      ]);
      setPrompts(items);
      setCategories(categoryItems);
      setTags(tagItems);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "Failed to load prompts",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [search, category, selectedTag, showArchived, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openPromptId || loading) return;
    const prompt = prompts.find((entry) => entry.id === openPromptId);
    if (prompt) {
      setEditingPrompt(prompt);
      setEditorOpen(true);
      onOpenPromptHandled?.();
    }
  }, [openPromptId, prompts, loading, onOpenPromptHandled]);

  const pinnedPrompts = useMemo(() => prompts.filter((prompt) => prompt.isPinned), [prompts]);
  const recentPrompts = useMemo(
    () =>
      prompts.filter(
        (prompt) =>
          !prompt.isPinned && prompt.lastUsedAt !== null && !prompt.isArchived,
      ),
    [prompts],
  );
  const otherPrompts = useMemo(
    () =>
      prompts.filter(
        (prompt) =>
          !prompt.isPinned &&
          prompt.lastUsedAt === null &&
          !prompt.isArchived,
      ),
    [prompts],
  );
  const archivedPrompts = useMemo(
    () => prompts.filter((prompt) => prompt.isArchived),
    [prompts],
  );

  const handleSave = async (values: PromptEditorValues) => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, values);
      pushToast({ tone: "success", title: "Prompt updated" });
    } else {
      await createPrompt(values);
      pushToast({ tone: "success", title: "Prompt created" });
    }
    await load();
  };

  const handleDuplicate = async (prompt: PromptTemplate) => {
    await duplicatePrompt(prompt.id);
    pushToast({ tone: "success", title: "Prompt duplicated" });
    await load();
  };

  const handleDelete = async (prompt: PromptTemplate) => {
    if (!window.confirm(`Delete "${prompt.title}"?`)) return;
    await deletePrompt(prompt.id);
    pushToast({ tone: "success", title: "Prompt deleted" });
    await load();
  };

  const renderPromptCard = (prompt: PromptTemplate) => (
    <article
      key={prompt.id}
      className="rounded-xl border border-border-subtle bg-elevated p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {prompt.isPinned ? <span aria-hidden>📌</span> : null}
            <h3 className="font-medium text-primary">{prompt.title}</h3>
          </div>
          <p className="mt-1 text-sm text-secondary">
            {prompt.description || prompt.userPromptTemplate.slice(0, 120)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-secondary">
            <span>{prompt.category}</span>
            {prompt.variables.length > 0 ? (
              <span>{prompt.variables.length} variable(s)</span>
            ) : null}
            {prompt.usageCount > 0 ? <span>Used {prompt.usageCount} times</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setUsePrompt(prompt)}>
            Use
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingPrompt(prompt);
              setEditorOpen(true);
            }}
          >
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDuplicate(prompt)}>
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(prompt)}>
            Delete
          </Button>
        </div>
      </div>
    </article>
  );

  const renderSection = (title: string, items: PromptTemplate[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">{title}</h2>
        <div className="space-y-3">{items.map(renderPromptCard)}</div>
      </section>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border-subtle px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-primary">Prompt Library</h1>
            <p className="text-sm text-secondary">
              Local reusable templates stored in SQLite on this device only.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingPrompt(null);
              setEditorOpen(true);
            }}
          >
            New Prompt
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search prompts…"
            className="min-w-[220px] flex-1 rounded-lg border border-border-subtle bg-muted px-3 py-2 text-sm"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-border-subtle bg-muted px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="rounded-lg border border-border-subtle bg-muted px-3 py-2 text-sm"
          >
            <option value="">All tags</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="text-secondary">Loading prompt library…</p>
        ) : prompts.length === 0 ? (
          <EmptyState
            title="No prompts yet"
            description="Create a template or save a message as a prompt to get started."
          />
        ) : (
          <div className="space-y-6">
            {renderSection("Pinned", pinnedPrompts)}
            {renderSection("Recent", recentPrompts)}
            {renderSection("All prompts", otherPrompts)}
            {showArchived ? renderSection("Archived", archivedPrompts) : null}
          </div>
        )}
      </section>

      <PromptEditorModal
        open={editorOpen}
        initial={editingPrompt}
        onClose={() => {
          setEditorOpen(false);
          setEditingPrompt(null);
        }}
        onSave={handleSave}
      />

      <UseTemplateDialog
        open={usePrompt !== null}
        prompt={usePrompt}
        onClose={() => setUsePrompt(null)}
        onConfirm={async (variables) => {
          if (!usePrompt) return;
          const result = await usePromptTemplate(usePrompt.id, variables);
          pushToast({ tone: "success", title: "Chat created from template" });
          onLaunchConversation({
            conversationId: result.conversationId,
            ragEnabled: result.ragEnabled,
            defaultTemperature: result.defaultTemperature,
          });
          await load();
        }}
      />
    </div>
  );
}
