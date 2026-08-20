import {
  BACKUP_SCHEMA_VERSION,
  type BackupManifest,
  type ConversationWithMessages,
  type DocumentRecord,
  type DuplicateStrategy,
  type ImportResult,
  type PromptTemplate,
} from "@localchat/shared";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { appConfig } from "../config.js";
import type { ChatRepository } from "../db/repository.js";
import type { DocumentRepository } from "../db/document-repository.js";
import { conversationToMarkdown } from "../db/repository.js";
import type { PromptRepository } from "../db/prompt-repository.js";
import { decryptBuffer, encryptBuffer, isEncryptedBackup } from "./encryption.js";
import { SearchIndexService } from "../search/search-index.js";

const MAX_ZIP_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024;

export interface ExportOptions {
  conversationIds?: string[];
  includeDocuments?: boolean;
  passphrase?: string;
}

export interface BackupPreviewData {
  manifest: BackupManifest;
  conversations: Array<{ id: string; title: string; messageCount: number }>;
  prompts: Array<{ id: string; title: string; category: string }>;
  documents: Array<{ id: string; originalName: string; fileSize: number }>;
  encrypted: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function safeZipPath(entryPath: string): string | null {
  const normalized = path.posix.normalize(entryPath.replace(/\\/g, "/"));
  if (
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("/") ||
    normalized === ".."
  ) {
    return null;
  }
  return normalized;
}

function assertZipPaths(
  zip: JSZip,
): { ok: true } | { ok: false; error: string } {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    return { ok: false, error: "Archive contains too many entries" };
  }

  for (const entry of entries) {
    if (entry.dir) continue;
    const name = safeZipPath(entry.name);
    if (!name) {
      return { ok: false, error: `Unsafe archive path: ${entry.name}` };
    }
  }
  return { ok: true };
}

async function assertZipSizes(
  zip: JSZip,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let totalUncompressed = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const content = await entry.async("nodebuffer");
    if (content.byteLength > MAX_SINGLE_FILE_BYTES) {
      return { ok: false, error: `File too large in archive: ${entry.name}` };
    }
    totalUncompressed += content.byteLength;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      return { ok: false, error: "Archive exceeds maximum uncompressed size" };
    }
  }
  return { ok: true };
}

export class BackupService {
  private readonly searchIndex = new SearchIndexService();

  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly promptRepo: PromptRepository,
    private readonly documentRepo: DocumentRepository,
  ) {}

  async exportConversationMarkdown(conversationId: string): Promise<string> {
    const conversation = this.chatRepo.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversationToMarkdown(conversation);
  }

  async exportConversationJson(conversationId: string): Promise<ConversationWithMessages> {
    const conversation = this.chatRepo.getConversation(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    return conversation;
  }

  async createZipBackup(options: ExportOptions = {}): Promise<Buffer> {
    const conversations = this.selectConversations(options.conversationIds);
    const prompts = this.promptRepo.listPrompts({ includeArchived: true });
    const documents = options.includeDocuments === false
      ? []
      : this.documentRepo.listDocuments();

    const zip = new JSZip();
    const checksums: Record<string, string> = {};

    const manifest: BackupManifest = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: "1.0.0",
      conversationCount: conversations.length,
      promptCount: prompts.length,
      documentCount: documents.length,
      checksumAlgorithm: "sha256",
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    zip.file("manifest.json", manifestJson);
    checksums["manifest.json"] = sha256(manifestJson);

    const promptsJson = JSON.stringify(prompts, null, 2);
    zip.file("prompts/prompts.json", promptsJson);
    checksums["prompts/prompts.json"] = sha256(promptsJson);

    for (const conversation of conversations) {
      const jsonPath = `conversations/${conversation.id}.json`;
      const mdPath = `conversations/${conversation.id}.md`;
      const json = JSON.stringify(conversation, null, 2);
      const md = conversationToMarkdown(conversation);
      zip.file(jsonPath, json);
      zip.file(mdPath, md);
      checksums[jsonPath] = sha256(json);
      checksums[mdPath] = sha256(md);
    }

    if (options.includeDocuments !== false) {
      for (const document of documents) {
        const storagePath = path.join(appConfig.documentsPath, document.storedName);
        if (!fs.existsSync(storagePath)) {
          continue;
        }
        const fileBuffer = fs.readFileSync(storagePath);
        const zipPath = `documents/${document.id}/${document.originalName}`;
        const safePath = safeZipPath(zipPath);
        if (!safePath) continue;
        zip.file(safePath, fileBuffer);
        checksums[safePath] = sha256(fileBuffer);
      }
      const docsMeta = JSON.stringify(documents, null, 2);
      zip.file("documents/manifest.json", docsMeta);
      checksums["documents/manifest.json"] = sha256(docsMeta);
    }

    const checksumsJson = JSON.stringify(checksums, null, 2);
    zip.file("checksums.json", checksumsJson);

    let archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    if (options.passphrase?.trim()) {
      archive = encryptBuffer(archive, options.passphrase.trim());
    }

    return archive;
  }

  async previewBackup(
    payload: Buffer,
    passphrase?: string,
  ): Promise<BackupPreviewData> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let encrypted = isEncryptedBackup(payload);
    let zipBuffer = payload;

    if (encrypted) {
      if (!passphrase?.trim()) {
        return {
          manifest: this.emptyManifest(),
          conversations: [],
          prompts: [],
          documents: [],
          encrypted: true,
          valid: false,
          errors: ["Passphrase required for encrypted backup"],
          warnings,
        };
      }
      try {
        zipBuffer = decryptBuffer(payload, passphrase.trim());
      } catch {
        return {
          manifest: this.emptyManifest(),
          conversations: [],
          prompts: [],
          documents: [],
          encrypted: true,
          valid: false,
          errors: ["Invalid passphrase or corrupted encrypted backup"],
          warnings,
        };
      }
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      return {
        manifest: this.emptyManifest(),
        conversations: [],
        prompts: [],
        documents: [],
        encrypted,
        valid: false,
        errors: ["Invalid ZIP archive"],
        warnings,
      };
    }

    const safety = assertZipPaths(zip);
    if (!safety.ok) {
      return {
        manifest: this.emptyManifest(),
        conversations: [],
        prompts: [],
        documents: [],
        encrypted,
        valid: false,
        errors: [safety.error],
        warnings,
      };
    }

    const sizeCheck = await assertZipSizes(zip);
    if (!sizeCheck.ok) {
      return {
        manifest: this.emptyManifest(),
        conversations: [],
        prompts: [],
        documents: [],
        encrypted,
        valid: false,
        errors: [sizeCheck.error],
        warnings,
      };
    }

    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      errors.push("Missing manifest.json");
      return {
        manifest: this.emptyManifest(),
        conversations: [],
        prompts: [],
        documents: [],
        encrypted,
        valid: false,
        errors,
        warnings,
      };
    }

    const manifest = JSON.parse(await manifestFile.async("string")) as BackupManifest;
    if (manifest.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      errors.push(`Unsupported schema version: ${manifest.schemaVersion}`);
    }

    const checksumsFile = zip.file("checksums.json");
    if (checksumsFile) {
      const checksums = JSON.parse(await checksumsFile.async("string")) as Record<
        string,
        string
      >;
      for (const [entryPath, expected] of Object.entries(checksums)) {
        const entry = zip.file(entryPath);
        if (!entry) {
          warnings.push(`Missing checksum entry: ${entryPath}`);
          continue;
        }
        const actual = sha256(await entry.async("nodebuffer"));
        if (actual !== expected) {
          errors.push(`Checksum mismatch: ${entryPath}`);
        }
      }
    } else {
      warnings.push("Missing checksums.json");
    }

    const conversations: BackupPreviewData["conversations"] = [];
    for (const filename of Object.keys(zip.files)) {
      if (!filename.startsWith("conversations/") || !filename.endsWith(".json")) {
        continue;
      }
      const content = await zip.file(filename)!.async("string");
      const parsed = JSON.parse(content) as ConversationWithMessages;
      conversations.push({
        id: parsed.id,
        title: parsed.title,
        messageCount: parsed.messages.length,
      });
    }

    let prompts: BackupPreviewData["prompts"] = [];
    const promptsFile = zip.file("prompts/prompts.json");
    if (promptsFile) {
      const parsed = JSON.parse(await promptsFile.async("string")) as PromptTemplate[];
      prompts = parsed.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
        category: prompt.category,
      }));
    }

    let documents: BackupPreviewData["documents"] = [];
    const docsMetaFile = zip.file("documents/manifest.json");
    if (docsMetaFile) {
      const parsed = JSON.parse(await docsMetaFile.async("string")) as DocumentRecord[];
      documents = parsed.map((document) => ({
        id: document.id,
        originalName: document.originalName,
        fileSize: document.fileSize,
      }));
    }

    return {
      manifest,
      conversations,
      prompts,
      documents,
      encrypted,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async importBackup(
    payload: Buffer,
    strategy: DuplicateStrategy,
    confirm: boolean,
    passphrase?: string,
  ): Promise<ImportResult> {
    if (!confirm) {
      throw new Error("Import requires explicit confirmation");
    }

    const preview = await this.previewBackup(payload, passphrase);
    if (!preview.valid) {
      throw new Error(preview.errors.join("; ") || "Invalid backup");
    }

    let zipBuffer = payload;
    if (preview.encrypted) {
      zipBuffer = decryptBuffer(payload, passphrase!.trim());
    }
    const zip = await JSZip.loadAsync(zipBuffer);
    const safety = assertZipPaths(zip);
    if (!safety.ok) {
      throw new Error(safety.error);
    }
    const sizeCheck = await assertZipSizes(zip);
    if (!sizeCheck.ok) {
      throw new Error(sizeCheck.error);
    }

    const result: ImportResult = {
      importedConversations: 0,
      skippedConversations: 0,
      importedPrompts: 0,
      mergedPrompts: 0,
      importedDocuments: 0,
      errors: [],
    };

    const promptsFile = zip.file("prompts/prompts.json");
    if (promptsFile) {
      const prompts = JSON.parse(await promptsFile.async("string")) as PromptTemplate[];
      for (const prompt of prompts) {
        const existing = this.promptRepo.getPrompt(prompt.id) ?? this.promptRepo.findByTitle(prompt.title);
        if (existing) {
          if (strategy === "skip-duplicates") {
            continue;
          }
          if (strategy === "merge-prompts") {
            this.promptRepo.updatePrompt(existing.id, {
              description: prompt.description,
              category: prompt.category,
              tags: prompt.tags,
              systemPrompt: prompt.systemPrompt,
              userPromptTemplate: prompt.userPromptTemplate,
              variables: prompt.variables,
              defaultModel: prompt.defaultModel,
              defaultTemperature: prompt.defaultTemperature,
              ragEnabled: prompt.ragEnabled,
            });
            result.mergedPrompts += 1;
            continue;
          }
        }
        try {
          this.promptRepo.createPrompt({
            title: existing ? `${prompt.title} (imported)` : prompt.title,
            description: prompt.description,
            category: prompt.category,
            tags: prompt.tags,
            systemPrompt: prompt.systemPrompt,
            userPromptTemplate: prompt.userPromptTemplate,
            variables: prompt.variables,
            defaultModel: prompt.defaultModel,
            defaultTemperature: prompt.defaultTemperature,
            ragEnabled: prompt.ragEnabled,
            isPinned: prompt.isPinned,
          });
          result.importedPrompts += 1;
        } catch (error) {
          result.errors.push(
            error instanceof Error ? error.message : "Failed to import prompt",
          );
        }
      }
    }

    for (const filename of Object.keys(zip.files)) {
      if (!filename.startsWith("conversations/") || !filename.endsWith(".json")) {
        continue;
      }
      const parsed = JSON.parse(
        await zip.file(filename)!.async("string"),
      ) as ConversationWithMessages;
      const existing = this.chatRepo.getConversation(parsed.id);
      if (existing && strategy === "skip-duplicates") {
        result.skippedConversations += 1;
        continue;
      }

      const created = this.chatRepo.createConversation(
        {
          title: existing ? `${parsed.title} (imported)` : parsed.title,
          systemPrompt: parsed.systemPrompt,
          model: parsed.model,
        },
        parsed.model,
      );
      for (const message of parsed.messages) {
        if (message.role === "user" || message.role === "assistant") {
          this.chatRepo.addMessage(created.id, message.role, message.content);
        }
      }
      result.importedConversations += 1;
    }

    const docsMetaFile = zip.file("documents/manifest.json");
    if (docsMetaFile) {
      const documents = JSON.parse(await docsMetaFile.async("string")) as DocumentRecord[];
      for (const document of documents) {
        const existing = this.documentRepo.getDocument(document.id);
        if (existing && strategy === "skip-duplicates") {
          continue;
        }
        const zipPathPrefix = `documents/${document.id}/`;
        const entryName = Object.keys(zip.files).find(
          (name) => name.startsWith(zipPathPrefix) && !zip.files[name]!.dir,
        );
        if (!entryName) continue;
        const safeName = path.basename(document.originalName);
        const storedName = `${document.id}-${safeName}`;
        const targetPath = path.join(appConfig.documentsPath, storedName);
        const resolved = path.resolve(targetPath);
        if (!resolved.startsWith(path.resolve(appConfig.documentsPath))) {
          result.errors.push(`Blocked unsafe document path: ${document.originalName}`);
          continue;
        }
        const content = await zip.file(entryName)!.async("nodebuffer");
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content);
        if (!existing) {
          this.documentRepo.createDocument({
            id: document.id,
            originalName: document.originalName,
            storedName,
            mimeType: document.mimeType,
            fileSize: content.byteLength,
          });
        }
        result.importedDocuments += 1;
      }
    }

    this.searchIndex.rebuildAll();
    return result;
  }

  private selectConversations(conversationIds?: string[]): ConversationWithMessages[] {
    if (conversationIds && conversationIds.length > 0) {
      return conversationIds
        .map((id) => this.chatRepo.getConversation(id))
        .filter((item): item is ConversationWithMessages => item !== null);
    }
    return this.chatRepo
      .listConversations()
      .map((conversation) => this.chatRepo.getConversation(conversation.id))
      .filter((item): item is ConversationWithMessages => item !== null);
  }

  private emptyManifest(): BackupManifest {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date(0).toISOString(),
      appVersion: "1.0.0",
      conversationCount: 0,
      promptCount: 0,
      documentCount: 0,
      checksumAlgorithm: "sha256",
    };
  }
}
