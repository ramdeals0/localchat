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
import { SearchRepository } from "../src/search/search-repository.js";

describe("SearchRepository", () => {
  let dbPath: string;
  let chatRepo: ChatRepository;
  let promptRepo: PromptRepository;
  let searchRepo: SearchRepository;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-search-test-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    const db = getDatabase();
    chatRepo = new ChatRepository(db);
    promptRepo = new PromptRepository(db);
    searchRepo = new SearchRepository(db);
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env.DATABASE_PATH;
  });

  it("indexes and searches conversations, messages, and prompts via triggers", () => {
    const conversation = chatRepo.createConversation(
      { title: "Offline planning", systemPrompt: "Be concise" },
      "qwen2.5:7b",
    );
    chatRepo.addMessage(conversation.id, "user", "How do I package LocalChat?");
    chatRepo.addMessage(
      conversation.id,
      "assistant",
      "Use Tauri with a local sidecar server.",
    );
    promptRepo.createPrompt({
      title: "Packaging checklist",
      userPromptTemplate: "List packaging steps for {{platform}}",
      category: "Dev",
    });

    const messageHits = searchRepo.search({
      q: "Tauri sidecar",
      ftsQuery: '"Tauri" "sidecar"',
      types: ["message"],
      limit: 25,
      offset: 0,
    });
    expect(messageHits.total).toBeGreaterThan(0);
    expect(messageHits.hits[0]?.entityType).toBe("message");

    const promptHits = searchRepo.search({
      q: "packaging checklist",
      ftsQuery: '"packaging" "checklist"',
      types: ["prompt"],
      limit: 25,
      offset: 0,
    });
    expect(promptHits.total).toBeGreaterThan(0);
    expect(promptHits.hits[0]?.entityType).toBe("prompt");

    const roleHits = searchRepo.search({
      q: "LocalChat",
      ftsQuery: '"LocalChat"',
      types: ["message"],
      role: "user",
      limit: 25,
      offset: 0,
    });
    expect(roleHits.hits.every((hit) => hit.role === "user")).toBe(true);
  });

  it("filters by type and ranks the most relevant message first", () => {
    const conversation = chatRepo.createConversation({ title: "Rank test" }, "qwen2.5:7b");
    chatRepo.addMessage(conversation.id, "user", "zebra");
    chatRepo.addMessage(conversation.id, "assistant", "zebra zebra zebra offline");

    const hits = searchRepo.search({
      q: "zebra offline",
      ftsQuery: '"zebra" "offline"',
      types: ["message"],
      limit: 10,
      offset: 0,
    });

    expect(hits.total).toBeGreaterThan(0);
    expect(hits.hits[0]?.entityType).toBe("message");
    expect(hits.hits[0]?.rank).toBeLessThanOrEqual(hits.hits.at(-1)?.rank ?? 0);
  });
});
