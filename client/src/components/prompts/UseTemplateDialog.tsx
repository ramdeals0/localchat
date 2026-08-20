import type { PromptTemplate } from "@localchat/shared";
import { useEffect, useState } from "react";
import { renderPrompt } from "../../api/client";
import { Button } from "../ui/Primitives";

interface UseTemplateDialogProps {
  open: boolean;
  prompt: PromptTemplate | null;
  onClose: () => void;
  onConfirm: (variables: Record<string, string>) => Promise<void>;
}

export function UseTemplateDialog({
  open,
  prompt,
  onClose,
  onConfirm,
}: UseTemplateDialogProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ systemPrompt: string; userPrompt: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !prompt) return;
    const initial: Record<string, string> = {};
    for (const name of prompt.variables) {
      initial[name] = "";
    }
    setVariables(initial);
    setError(null);
    setPreview(null);
  }, [open, prompt]);

  useEffect(() => {
    if (!open || !prompt) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const rendered = await renderPrompt(prompt.id, variables);
          setPreview({ systemPrompt: rendered.systemPrompt, userPrompt: rendered.userPrompt });
          setError(null);
        } catch (previewError) {
          setPreview(null);
          setError(previewError instanceof Error ? previewError.message : "Preview failed");
        }
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [open, prompt, variables]);

  if (!open || !prompt) return null;

  return (
    <div className="fixed inset-0 z-[94] flex items-center justify-center px-4">
      <button type="button" aria-label="Close use dialog" className="drawer-backdrop absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Use template ${prompt.title}`}
        className="relative z-10 w-full max-w-xl rounded-xl border border-border-subtle bg-elevated p-6 shadow-overlay"
      >
        <h2 className="text-lg font-semibold text-primary">Use template</h2>
        <p className="mt-1 text-sm text-secondary">{prompt.title}</p>

        <div className="mt-4 space-y-3">
          {prompt.variables.map((name) => (
            <label key={name} className="block text-sm">
              <span className="mb-1 block text-secondary">{name}</span>
              <input
                value={variables[name] ?? ""}
                onChange={(event) =>
                  setVariables((current) => ({ ...current, [name]: event.target.value }))
                }
                className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
              />
            </label>
          ))}
        </div>

        {preview ? (
          <div className="mt-4 rounded-xl border border-border-subtle bg-muted p-4">
            <h3 className="text-sm font-semibold text-primary">Preview</h3>
            {preview.systemPrompt ? (
              <p className="mt-2 whitespace-pre-wrap text-xs text-secondary">
                <span className="font-semibold text-primary">System:</span> {preview.systemPrompt}
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{preview.userPrompt}</p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm(variables);
                  onClose();
                } catch (confirmError) {
                  setError(
                    confirmError instanceof Error ? confirmError.message : "Failed to use template",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Creating chat…" : "Create chat"}
          </Button>
        </div>
      </div>
    </div>
  );
}
