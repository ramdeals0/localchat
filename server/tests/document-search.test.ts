import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseDocumentSearchParams } from "@localchat/shared";
import { createApp } from "../src/app.js";
import { closeDatabase, getDatabase, resetDatabaseForTests } from "../src/db/database.js";
import { DocumentRepository } from "../src/db/document-repository.js";
import { PromptRepository } from "../src/db/prompt-repository.js";
import { ChatRepository } from "../src/db/repository.js";
import { DocumentSearchRepository } from "../src/search/document-search-repository.js";

function indexReadyDocument(
  repo: DocumentRepository,
  input: {
    originalName: string;
    storedName: string;
    content: string;
  },
) {
  const document = repo.createDocument({
    originalName: input.originalName,
    storedName: input.storedName,
    mimeType: "text/plain",
    fileSize: input.content.length,
  });

  repo.insertChunks(document.id, [
    {
      chunkIndex: 0,
      pageNumber: null,
      charStart: 0,
      charEnd: input.content.length,
      content: input.content,
      embedding: [1, 0, 0],
    },
  ]);

  repo.updateDocumentStatus(document.id, "ready", {
    chunkCount: 1,
    indexedAt: new Date().toISOString(),
  });

  return document;
}

function parseDocumentSearch(query: string, documentIds?: string) {
  const parsed = parseDocumentSearchParams({ q: query, documentIds });
  if (Array.isArray(parsed)) {
    throw new Error(parsed.map((entry) => entry.message).join("; "));
  }
  return parsed;
}

describe("DocumentSearchRepository", () => {
  let dbPath: string;
  let documentRepo: DocumentRepository;
  let chatRepo: ChatRepository;
  let promptRepo: PromptRepository;
  let searchRepo: DocumentSearchRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-doc-search-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    const db = getDatabase();
    documentRepo = new DocumentRepository(db);
    chatRepo = new ChatRepository(db);
    promptRepo = new PromptRepository(db);
    searchRepo = new DocumentSearchRepository(db);
    app = createApp();
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    delete process.env.DATABASE_PATH;
  });

  it("returns only ready uploaded document chunks", () => {
    indexReadyDocument(documentRepo, {
      originalName: "policy.txt",
      storedName: "policy.txt",
      content: "refund within thirty days for local purchases",
    });

    const queued = documentRepo.createDocument({
      originalName: "draft.txt",
      storedName: "draft.txt",
      mimeType: "text/plain",
      fileSize: 20,
    });
    documentRepo.insertChunks(queued.id, [
      {
        chunkIndex: 0,
        pageNumber: null,
        charStart: 0,
        charEnd: 20,
        content: "refund draft should not appear",
        embedding: [1, 0, 0],
      },
    ]);

    const hits = searchRepo.search(parseDocumentSearch("refund"));

    expect(hits.total).toBe(1);
    expect(hits.hits[0]?.originalName).toBe("policy.txt");
  });

  it("never returns chat messages or prompt templates", () => {
    indexReadyDocument(documentRepo, {
      originalName: "guide.txt",
      storedName: "guide.txt",
      content: "unique-doc-marker-alpha",
    });

    const conversation = chatRepo.createConversation({ title: "Chat title" }, "qwen2.5:7b");
    chatRepo.addMessage(conversation.id, "user", "unique-doc-marker-alpha in chat");
    promptRepo.createPrompt({
      title: "Prompt with unique-doc-marker-alpha",
      userPromptTemplate: "unique-doc-marker-alpha in prompt",
    });

    const hits = searchRepo.search(parseDocumentSearch("unique-doc-marker-alpha"));

    expect(hits.total).toBe(1);
    expect(hits.hits.every((hit) => hit.originalName === "guide.txt")).toBe(true);
  });

  it("restricts results to selected document IDs", () => {
    const first = indexReadyDocument(documentRepo, {
      originalName: "first.txt",
      storedName: "first.txt",
      content: "shared-keyword-one",
    });
    indexReadyDocument(documentRepo, {
      originalName: "second.txt",
      storedName: "second.txt",
      content: "shared-keyword-two",
    });

    const hits = searchRepo.search(parseDocumentSearch("shared-keyword", first.id));

    expect(hits.total).toBe(1);
    expect(hits.hits[0]?.documentId).toBe(first.id);
  });

  it("removes deleted documents from search results via triggers", () => {
    const document = indexReadyDocument(documentRepo, {
      originalName: "delete-me.txt",
      storedName: "delete-me.txt",
      content: "temporary-delete-marker",
    });

    expect(searchRepo.search(parseDocumentSearch("temporary-delete-marker")).total).toBe(1);

    documentRepo.deleteDocument(document.id);

    expect(searchRepo.search(parseDocumentSearch("temporary-delete-marker")).total).toBe(0);
  });

  it("exposes document search through GET /api/documents/search", async () => {
    indexReadyDocument(documentRepo, {
      originalName: "api.txt",
      storedName: "api.txt",
      content: "api-visible-chunk-content",
    });

    await request(app).get("/api/documents/search").expect(400);

    const response = await request(app)
      .get("/api/documents/search?q=api-visible-chunk")
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.hits[0].snippetParts.length).toBeGreaterThan(0);
  });
});
