import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeDatabase, getDatabase, resetDatabaseForTests } from "../src/db/database.js";
import { PromptRepository } from "../src/db/prompt-repository.js";
import { ChatRepository } from "../src/db/repository.js";
import { SearchIndexService } from "../src/search/search-index.js";
import { SearchRepository } from "../src/search/search-repository.js";

describe("local search integration", () => {
  let dbPath: string;
  let app: ReturnType<typeof createApp>;
  let chatRepo: ChatRepository;
  let promptRepo: PromptRepository;
  let searchRepo: SearchRepository;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-search-int-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    const db = getDatabase();
    chatRepo = new ChatRepository(db);
    promptRepo = new PromptRepository(db);
    searchRepo = new SearchRepository(db);
    app = createApp();
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.DATABASE_PATH;
  });

  it("searches a message via triggers without manual indexing", () => {
    const conversation = chatRepo.createConversation(
      { title: "Packaging notes", systemPrompt: "" },
      "qwen2.5:7b",
    );
    chatRepo.addMessage(conversation.id, "user", "How do I package LocalChat with Tauri?");

    const hits = searchRepo.search({
      q: "Tauri package",
      ftsQuery: '"Tauri" "package"',
      types: ["message"],
      limit: 25,
      offset: 0,
    });

    expect(hits.total).toBeGreaterThan(0);
    expect(hits.hits[0]?.entityType).toBe("message");
    expect(hits.hits[0]?.snippetParts.length).toBeGreaterThan(0);
  });

  it("stops matching updated message text after an edit", () => {
    const conversation = chatRepo.createConversation({ title: "Edit me" }, "qwen2.5:7b");
    const message = chatRepo.addMessage(conversation.id, "user", "Alpha beta gamma");
    chatRepo.updateMessage(message.id, "Alpha delta gamma");

    const oldHits = searchRepo.search({
      q: "beta",
      ftsQuery: '"beta"',
      types: ["message"],
      limit: 25,
      offset: 0,
    });
    expect(oldHits.total).toBe(0);

    const newHits = searchRepo.search({
      q: "delta",
      ftsQuery: '"delta"',
      types: ["message"],
      limit: 25,
      offset: 0,
    });
    expect(newHits.total).toBe(1);
  });

  it("removes deleted conversation content from search", () => {
    const conversation = chatRepo.createConversation(
      { title: "Delete soon" },
      "qwen2.5:7b",
    );
    chatRepo.addMessage(conversation.id, "user", "Unique delete marker xyz");
    chatRepo.deleteConversation(conversation.id);

    const hits = searchRepo.search({
      q: "Delete soon",
      ftsQuery: '"Delete" "soon"',
      types: ["conversation", "message"],
      limit: 25,
      offset: 0,
    });
    expect(hits.total).toBe(0);
  });

  it("finds prompt templates and supports rebuild", () => {
    promptRepo.createPrompt({
      title: "Packaging checklist",
      userPromptTemplate: "List packaging steps for {{platform}}",
      category: "Dev",
    });

    const hits = searchRepo.search({
      q: "packaging checklist",
      ftsQuery: '"packaging" "checklist"',
      types: ["prompt"],
      limit: 25,
      offset: 0,
    });
    expect(hits.total).toBe(1);

    const rebuild = new SearchIndexService().rebuildAll();
    expect(rebuild.prompts).toBeGreaterThan(0);
    expect(rebuild.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns API validation and no-match responses", async () => {
    await request(app).get("/api/search").expect(400);
    await request(app).get("/api/search?q=missing-term-xyz").expect(200).expect((response) => {
      expect(response.body.total).toBe(0);
    });
  });

  it("rebuilds indexes through the maintenance API", async () => {
    chatRepo.createConversation({ title: "Rebuild me" }, "qwen2.5:7b");
    const response = await request(app).post("/api/search/rebuild").expect(200);
    expect(response.body.conversations).toBeGreaterThan(0);
    expect(response.body.durationMs).toBeGreaterThanOrEqual(0);
  });
});
