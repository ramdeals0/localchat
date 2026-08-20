import type { OllamaStatus } from "@localchat/shared";
import { Badge, Button, IconButton } from "../ui/Primitives";
import { StatusIndicator } from "../StatusIndicator";

interface ChatHeaderProps {
  title: string;
  model: string;
  modelOptions: string[];
  status: OllamaStatus | null;
  statusLoading: boolean;
  useDocuments: boolean;
  requireEmbedding: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  onModelChange: (model: string) => void;
  onToggleDocuments: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onOpenSettings: () => void;
  onRegenerate: () => void;
  onClear: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  canAct: boolean;
  isStreaming: boolean;
}

export function ChatHeader({
  title,
  model,
  modelOptions,
  status,
  statusLoading,
  useDocuments,
  requireEmbedding,
  leftOpen,
  rightOpen,
  onModelChange,
  onToggleDocuments,
  onToggleLeft,
  onToggleRight,
  onOpenSettings,
  onRegenerate,
  onClear,
  onExportMarkdown,
  onExportJson,
  canAct,
  isStreaming,
}: ChatHeaderProps) {
  return (
    <header className="border-b border-border-subtle bg-base/80 px-5 py-4 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 hidden items-center gap-2 lg:flex">
            <IconButton label={leftOpen ? "Hide sidebar" : "Show sidebar"} onClick={onToggleLeft}>
              ☰
            </IconButton>
            <IconButton
              label={rightOpen ? "Hide context panel" : "Show context panel"}
              onClick={onToggleRight}
            >
              ⧉
            </IconButton>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight text-primary">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusIndicator
              status={status}
              loading={statusLoading}
              requireEmbedding={requireEmbedding}
            />
            <Badge tone="accent">{model}</Badge>
            {useDocuments ? <Badge tone="info">Document mode</Badge> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="header-model">
            Model
          </label>
          <select
            id="header-model"
            value={model}
            disabled={!canAct}
            onChange={(event) => onModelChange(event.target.value)}
            className="rounded-lg border border-border-subtle bg-elevated px-3 py-2 text-sm text-primary"
          >
            {modelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant={useDocuments ? "primary" : "secondary"}
            onClick={onToggleDocuments}
          >
            Documents
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenSettings}>
            Settings
          </Button>
          <Button
            size="sm"
            disabled={!canAct || isStreaming}
            onClick={onRegenerate}
          >
            Regenerate
          </Button>
          <Button size="sm" disabled={!canAct} onClick={onClear}>
            Clear
          </Button>
          <Button size="sm" disabled={!canAct} onClick={onExportMarkdown}>
            Export MD
          </Button>
          <Button size="sm" disabled={!canAct} onClick={onExportJson}>
            Export JSON
          </Button>
        </div>
      </div>
    </header>
  );
}
