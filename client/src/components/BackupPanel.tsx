import type { BackupPreview, DuplicateStrategy } from "@localchat/shared";
import { useState } from "react";
import {
  downloadBackupZip,
  importBackup,
  previewBackup,
  rebuildSearch,
} from "../api/client";
import { Button } from "./ui/Primitives";

interface BackupPanelProps {
  selectedConversationIds?: string[];
  onImported?: () => void;
}

export function BackupPanel({ selectedConversationIds, onImported }: BackupPanelProps) {
  const [passphrase, setPassphrase] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("import-new");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (file: File) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await previewBackup(file, passphrase || undefined);
      setPreview(result);
      setSelectedFile(file);
      if (!result.valid) {
        setError(result.errors.join("; "));
      }
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview failed");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !preview?.valid) return;
    if (
      !window.confirm(
        "Import backup data into LocalChat? Existing duplicates will follow your selected strategy.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await importBackup(
        selectedFile,
        duplicateStrategy,
        true,
        passphrase || undefined,
      );
      setMessage(
        `Imported ${result.importedConversations} conversations, ${result.importedPrompts} prompts, ${result.importedDocuments} documents.`,
      );
      onImported?.();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRebuild = async () => {
    if (
      !window.confirm(
        "Rebuild all local search indexes? This maintenance step re-reads conversations, messages, and prompts from SQLite.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await rebuildSearch();
      setMessage(
        `Rebuilt indexes: ${result.conversations} conversations, ${result.messages} messages, ${result.prompts} prompts (${result.durationMs} ms).`,
      );
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : "Rebuild failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="font-semibold text-primary">Export</h3>
        <p className="mt-1 text-secondary">
          Export selected conversations or a full workspace backup as ZIP with manifest and
          checksums.
        </p>
        <label className="mt-3 block text-secondary">
          Optional encryption passphrase (never stored)
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() =>
              downloadBackupZip({
                conversationIds: selectedConversationIds,
                passphrase: passphrase || undefined,
              })
            }
          >
            Export selected ZIP
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => downloadBackupZip({ passphrase: passphrase || undefined })}
          >
            Export full workspace
          </Button>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h3 className="font-semibold text-primary">Import</h3>
        <p className="mt-1 text-secondary">
          Validation-first preview before import. Requires explicit confirmation.
        </p>
        <input
          type="file"
          accept=".zip,.enc,application/zip"
          className="mt-3 block w-full text-secondary"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handlePreview(file);
          }}
        />
        <label className="mt-3 block text-secondary">
          Duplicate strategy
          <select
            value={duplicateStrategy}
            onChange={(event) =>
              setDuplicateStrategy(event.target.value as DuplicateStrategy)
            }
            className="mt-1 w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
          >
            <option value="import-new">Import as new copies</option>
            <option value="skip-duplicates">Skip duplicates</option>
            <option value="merge-prompts">Merge prompts only</option>
          </select>
        </label>
        {preview ? (
          <div className="mt-3 rounded-xl border border-border-subtle bg-muted p-3">
            <p className="font-medium text-primary">Backup preview</p>
            <ul className="mt-2 space-y-1 text-secondary">
              <li>Schema: {preview.manifest.schemaVersion}</li>
              <li>Conversations: {preview.conversations.length}</li>
              <li>Prompts: {preview.prompts.length}</li>
              <li>Documents: {preview.documents.length}</li>
              <li>Encrypted: {preview.encrypted ? "Yes" : "No"}</li>
            </ul>
            {preview.warnings.length > 0 ? (
              <p className="mt-2 text-warning">{preview.warnings.join("; ")}</p>
            ) : null}
            <Button
              className="mt-3"
              disabled={busy || !preview.valid}
              onClick={() => void handleImport()}
            >
              Confirm import
            </Button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border-subtle pt-4">
        <h3 className="font-semibold text-primary">Search index</h3>
        <p className="mt-1 text-secondary">Rebuild the local FTS5 index from SQLite data.</p>
        <Button className="mt-3" variant="ghost" disabled={busy} onClick={() => void handleRebuild()}>
          Rebuild search indexes
        </Button>
      </div>

      {message ? <p className="text-success">{message}</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}
    </div>
  );
}
