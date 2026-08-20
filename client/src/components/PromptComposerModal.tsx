import type { PromptTemplate } from "@localchat/shared";
import { useEffect, useState } from "react";
import { listPrompts, usePromptTemplate } from "../api/client";
import { UseTemplateDialog } from "./prompts/UseTemplateDialog";
import { Button } from "./ui/Primitives";

interface PromptComposerModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchConversation: (payload: {
    conversationId: string;
    ragEnabled: boolean;
    defaultTemperature: number | null;
  }) => void;
}

export function PromptComposerModal({
  open,
  onClose,
  onLaunchConversation,
}: PromptComposerModalProps) {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setPickerOpen(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const items = await listPrompts();
        setPrompts(items.filter((prompt) => !prompt.isArchived));
        setPickerOpen(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  return (
    <>
      {pickerOpen && !selected ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close prompt composer"
            className="drawer-backdrop absolute inset-0"
            onClick={onClose}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border-subtle bg-elevated p-5 shadow-overlay">
            <h2 className="text-lg font-semibold text-primary">Choose prompt template</h2>
            {loading ? (
              <p className="mt-4 text-sm text-secondary">Loading prompts…</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                {prompts.map((prompt) => (
                  <li key={prompt.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(prompt);
                        setPickerOpen(false);
                      }}
                      className="w-full rounded-lg border border-border-subtle px-3 py-3 text-left hover:bg-muted"
                    >
                      <span className="font-medium text-primary">{prompt.title}</span>
                      <p className="mt-1 text-xs text-secondary">{prompt.category}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <UseTemplateDialog
        open={Boolean(selected)}
        prompt={selected}
        onClose={onClose}
        onConfirm={async (variables) => {
          if (!selected) return;
          const result = await usePromptTemplate(selected.id, variables);
          onLaunchConversation({
            conversationId: result.conversationId,
            ragEnabled: result.ragEnabled,
            defaultTemperature: result.defaultTemperature,
          });
        }}
      />
    </>
  );
}
