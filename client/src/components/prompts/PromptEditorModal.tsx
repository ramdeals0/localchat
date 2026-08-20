import type { CreatePromptRequest, PromptTemplate, UpdatePromptRequest } from "@localchat/shared";
import { parsePromptVariables } from "@localchat/shared";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Primitives";

export type PromptEditorValues = CreatePromptRequest & { isArchived?: boolean };

interface PromptEditorModalProps {
  open: boolean;
  initial?: PromptTemplate | null;
  onClose: () => void;
  onSave: (values: PromptEditorValues) => Promise<void>;
}

const emptyValues: PromptEditorValues = {
  title: "",
  description: "",
  category: "Custom",
  tags: [],
  systemPrompt: "",
  userPromptTemplate: "",
  defaultModel: "",
  defaultTemperature: null,
  ragEnabled: false,
  isPinned: false,
  isArchived: false,
};

export function PromptEditorModal({ open, initial, onClose, onSave }: PromptEditorModalProps) {
  const [values, setValues] = useState<PromptEditorValues>(emptyValues);
  const [tagsInput, setTagsInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setValues({
        title: initial.title,
        description: initial.description ?? "",
        category: initial.category,
        tags: initial.tags,
        systemPrompt: initial.systemPrompt ?? "",
        userPromptTemplate: initial.userPromptTemplate,
        defaultModel: initial.defaultModel ?? "",
        defaultTemperature: initial.defaultTemperature,
        ragEnabled: initial.ragEnabled,
        isPinned: initial.isPinned,
        isArchived: initial.isArchived,
      });
      setTagsInput(initial.tags.join(", "));
    } else {
      setValues(emptyValues);
      setTagsInput("");
    }
    setError(null);
  }, [open, initial]);

  const detectedVariables = useMemo(
    () =>
      parsePromptVariables(values.systemPrompt ?? "", values.userPromptTemplate ?? ""),
    [values.systemPrompt, values.userPromptTemplate],
  );

  if (!open) return null;

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: PromptEditorValues = {
        ...values,
        title: values.title.trim(),
        userPromptTemplate: values.userPromptTemplate.trim(),
        category: values.category?.trim() || "Custom",
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        defaultModel: values.defaultModel?.trim() ? values.defaultModel.trim() : null,
        variables: detectedVariables,
      };
      await onSave(payload);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save prompt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[93] flex items-center justify-center px-4">
      <button type="button" aria-label="Close editor" className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit prompt template" : "New prompt template"}
        className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border-subtle bg-elevated p-6 shadow-overlay"
      >
        <h2 className="text-lg font-semibold text-primary">
          {initial ? "Edit prompt template" : "New prompt template"}
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-secondary">Title</span>
            <input
              value={values.title}
              onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-secondary">Description</span>
            <textarea
              value={values.description ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
              rows={2}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-secondary">Category</span>
            <input
              value={values.category ?? "Custom"}
              onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-secondary">Tags (comma separated)</span>
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-secondary">Default model</span>
            <input
              value={values.defaultModel ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, defaultModel: event.target.value }))
              }
              placeholder="Optional"
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-secondary">Default temperature</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={values.defaultTemperature ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  defaultTemperature: event.target.value ? Number(event.target.value) : null,
                }))
              }
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.ragEnabled ?? false}
              onChange={(event) =>
                setValues((current) => ({ ...current, ragEnabled: event.target.checked }))
              }
            />
            Enable RAG by default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isPinned ?? false}
              onChange={(event) =>
                setValues((current) => ({ ...current, isPinned: event.target.checked }))
              }
            />
            Pin template
          </label>
          {initial ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isArchived ?? false}
                onChange={(event) =>
                  setValues((current) => ({ ...current, isArchived: event.target.checked }))
                }
              />
              Archive template
            </label>
          ) : null}
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-secondary">System prompt</span>
            <textarea
              value={values.systemPrompt ?? ""}
              onChange={(event) =>
                setValues((current) => ({ ...current, systemPrompt: event.target.value }))
              }
              rows={4}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-secondary">User prompt template</span>
            <textarea
              value={values.userPromptTemplate}
              onChange={(event) =>
                setValues((current) => ({ ...current, userPromptTemplate: event.target.value }))
              }
              rows={6}
              className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-border-subtle bg-muted p-4">
          <h3 className="text-sm font-semibold text-primary">Detected variables</h3>
          {detectedVariables.length === 0 ? (
            <p className="mt-2 text-sm text-secondary">No variables detected.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {detectedVariables.map((name) => (
                <li
                  key={name}
                  className="rounded-full bg-elevated px-3 py-1 font-mono text-xs text-primary"
                >
                  {`{{${name}}}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
