import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  getDatabase,
  resetDatabaseForTests,
} from "../src/db/database.js";
import { DocumentRepository } from "../src/db/document-repository.js";
import { PromptRepository } from "../src/db/prompt-repository.js";
import { ChatRepository } from "../src/db/repository.js";
import { BackupService } from "../src/export/backup-service.js";

describe("BackupService", () => {
  let dbPath: string;
  let docsPath: string;
  let chatRepo: ChatRepository;
  let promptRepo: PromptRepository;
  let documentRepo: DocumentRepository;
  let backupService: BackupService;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-backup-test-${Date.now()}-${Math.random()}.db`,
    );
    docsPath = path.join(os.tmpdir(), `localchat-docs-${Date.now()}`);
    fs.mkdirSync(docsPath, { recursive: true });
    process.env.DATABASE_PATH = dbPath;
    process.env.DOCUMENTS_PATH = docsPath;

    const db = getDatabase();
    chatRepo = new ChatRepository(db);
    promptRepo = new PromptRepository(db);
    documentRepo = new DocumentRepository(db);
    backupService = new BackupService(chatRepo, promptRepo, documentRepo);
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(docsPath)) fs.rmSync(docsPath, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
    delete process.env.DOCUMENTS_PATH;
  });

  it("exports, previews, and imports a workspace backup", async () => {
    const conversation = chatRepo.createConversation(
      { title: "Backup chat" },
      "qwen2.5:7b",
    );
    chatRepo.addMessage(conversation.id, "user", "Store this locally");
    promptRepo.createPrompt({
      title: "Imported prompt",
      userPromptTemplate: "Hello {{name}}",
    });

    const archive = await backupService.createZipBackup();
    const preview = await backupService.previewBackup(archive);
    expect(preview.valid).toBe(true);
    expect(preview.conversations).toHaveLength(1);
    expect(preview.prompts).toHaveLength(1);

    chatRepo.deleteConversation(conversation.id);
    promptRepo.listPrompts().forEach((prompt) => promptRepo.deletePrompt(prompt.id));
    expect(chatRepo.listConversations()).toHaveLength(0);

    const result = await backupService.importBackup(archive, "import-new", true);
    expect(result.importedConversations).toBe(1);
    expect(result.importedPrompts).toBe(1);
    expect(chatRepo.listConversations()).toHaveLength(1);
    expect(promptRepo.listPrompts()).toHaveLength(1);
  });

  it("supports encrypted backups", async () => {
    chatRepo.createConversation({ title: "Secret chat" }, "qwen2.5:7b");
    const archive = await backupService.createZipBackup({ passphrase: "local-secret" });
    const preview = await backupService.previewBackup(archive, "local-secret");
    expect(preview.valid).toBe(true);
    expect(preview.encrypted).toBe(true);
  });
});
