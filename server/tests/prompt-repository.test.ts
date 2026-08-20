import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  getDatabase,
  resetDatabaseForTests,
} from "../src/db/database.js";
import { PromptRepository } from "../src/db/prompt-repository.js";
import { ChatRepository } from "../src/db/repository.js";
import { PromptService } from "../src/services/prompt-service.js";
import { seedPromptTemplates, syncBuiltInPromptUpdates } from "../src/db/prompt-seed.js";

describe("PromptRepository", () => {
  let dbPath: string;
  let repo: PromptRepository;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-prompt-test-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    repo = new PromptRepository(getDatabase());
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.DATABASE_PATH;
  });

  it("creates, updates, duplicates, archives, and deletes prompts", () => {
    const created = repo.createPrompt({
      title: "Summarize",
      description: "Summarize text",
      category: "Writing",
      tags: ["summary"],
      systemPrompt: "You summarize clearly.",
      userPromptTemplate: "Summarize: {{topic}}",
      isPinned: true,
    });

    expect(created.variables).toEqual(["topic"]);
    expect(repo.listPrompts()).toHaveLength(1);

    const updated = repo.updatePrompt(created.id, { isArchived: true });
    expect(updated?.isArchived).toBe(true);
    expect(repo.listPrompts()).toHaveLength(0);
    expect(repo.listPrompts({ includeArchived: true })).toHaveLength(1);

    const copy = repo.duplicatePrompt(created.id);
    expect(copy?.title).toContain("(copy)");

    expect(repo.deletePrompt(created.id)).toBe(true);
  });

  it("seeds built-in prompts idempotently", () => {
    expect(seedPromptTemplates(repo)).toBe(5);
    expect(seedPromptTemplates(repo)).toBe(0);
    expect(repo.getPrompt("seed-explain-clearly")?.title).toBe("Explain clearly");
  });

  it("updates Analyze local documents to require summary with snippets", () => {
    seedPromptTemplates(repo);
    const analyze = repo.getPrompt("seed-analyze-local-documents");
    expect(analyze?.systemPrompt).toContain("Supporting snippets");
    expect(analyze?.userPromptTemplate).toContain("summary with supporting text snippets");

    repo.updatePrompt("seed-analyze-local-documents", {
      systemPrompt: "You analyze local documents accurately. Cite only what the provided context supports.",
      userPromptTemplate: "Analyze my local documents and answer: {{question}}",
    });
    syncBuiltInPromptUpdates(repo);
    const synced = repo.getPrompt("seed-analyze-local-documents");
    expect(synced?.systemPrompt).toContain("Supporting snippets");
    expect(synced?.userPromptTemplate).toContain("summary with supporting text snippets");
  });
});

describe("PromptService", () => {
  let dbPath: string;
  let promptRepo: PromptRepository;
  let chatRepo: ChatRepository;
  let service: PromptService;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-prompt-use-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    const db = getDatabase();
    promptRepo = new PromptRepository(db);
    chatRepo = new ChatRepository(db);
    service = new PromptService(promptRepo, chatRepo);
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.DATABASE_PATH;
  });

  it("uses a template to create a conversation atomically", () => {
    const prompt = promptRepo.createPrompt({
      title: "Launch me",
      userPromptTemplate: "Hello {{name}}",
      ragEnabled: true,
    });

    const result = service.usePrompt(prompt.id, { name: "LocalChat" }, "qwen2.5:7b");
    expect(result.conversationId).toBeTruthy();
    expect(result.conversation.title).toBe("Launch me");
    expect(result.conversation.messages).toHaveLength(1);
    expect(result.conversation.messages[0]?.content).toBe("Hello LocalChat");
    expect(result.ragEnabled).toBe(true);

    const refreshed = promptRepo.getPrompt(prompt.id);
    expect(refreshed?.usageCount).toBe(1);
    expect(refreshed?.lastUsedAt).toBeTruthy();
  });

  it("rejects incomplete variable values", () => {
    const prompt = promptRepo.createPrompt({
      title: "Needs vars",
      userPromptTemplate: "Explain {{topic}}",
    });

    expect(() => service.usePrompt(prompt.id, {}, "qwen2.5:7b")).toThrow();
  });
});
