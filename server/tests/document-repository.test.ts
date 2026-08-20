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
import { ChatRepository } from "../src/db/repository.js";

describe("DocumentRepository", () => {
  let dbPath: string;
  let repo: DocumentRepository;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-docs-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;
    repo = new DocumentRepository(getDatabase());
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env.DATABASE_PATH;
  });

  it("creates and lists documents", () => {
    const document = repo.createDocument({
      originalName: "notes.txt",
      storedName: "abc.txt",
      mimeType: "text/plain",
      fileSize: 120,
    });

    const list = repo.listDocuments();
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe("queued");
    expect(list[0]?.id).toBe(document.id);
    expect(list[0]?.indexProgressCurrent).toBe(0);
  });

  it("updates indexing progress", () => {
    const document = repo.createDocument({
      originalName: "progress.txt",
      storedName: "progress.txt",
      mimeType: "text/plain",
      fileSize: 120,
    });

    repo.updateDocumentStatus(document.id, "processing");
    const updated = repo.updateIndexProgress(document.id, {
      stage: "embedding",
      current: 2,
      total: 5,
    });

    expect(updated?.indexStage).toBe("embedding");
    expect(updated?.indexProgressCurrent).toBe(2);
    expect(updated?.indexProgressTotal).toBe(5);
  });

  it("stores chunks with embeddings and searches by cosine similarity", () => {
    const document = repo.createDocument({
      originalName: "policy.md",
      storedName: "policy.md",
      mimeType: "text/markdown",
      fileSize: 500,
    });

    repo.insertChunks(document.id, [
      {
        chunkIndex: 0,
        pageNumber: 1,
        charStart: 0,
        charEnd: 20,
        content: "refund within 30 days",
        embedding: [1, 0, 0],
      },
      {
        chunkIndex: 1,
        pageNumber: 2,
        charStart: 21,
        charEnd: 40,
        content: "shipping takes five business days",
        embedding: [0, 1, 0],
      },
    ]);

    repo.updateDocumentStatus(document.id, "ready", {
      chunkCount: 2,
      indexedAt: new Date().toISOString(),
    });

    const results = repo.searchChunks([1, 0, 0], {
      topK: 1,
      minSimilarity: 0.35,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain("refund");
  });

  it("deletes document chunks when document is deleted", () => {
    const document = repo.createDocument({
      originalName: "delete-me.txt",
      storedName: "delete-me.txt",
      mimeType: "text/plain",
      fileSize: 10,
    });

    repo.insertChunks(document.id, [
      {
        chunkIndex: 0,
        pageNumber: null,
        charStart: 0,
        charEnd: 4,
        content: "test",
        embedding: [1, 0],
      },
    ]);

    expect(repo.deleteDocument(document.id)).toBe(true);
    expect(repo.listChunks(document.id)).toHaveLength(0);
  });

  it("persists and retrieves message citations", () => {
    const chatRepo = new ChatRepository(getDatabase());
    const conversation = chatRepo.createConversation({}, "qwen2.5:7b");
    const message = chatRepo.addMessage(conversation.id, "assistant", "Answer");

    const citations = repo.saveCitations(message.id, [
      {
        messageId: message.id,
        chunkId: "chunk-1",
        documentId: "doc-1",
        originalName: "guide.pdf",
        pageNumber: 4,
        chunkIndex: 12,
        content: "Exact retrieved text",
        similarity: 0.82,
      },
    ]);

    expect(citations).toHaveLength(1);
    expect(repo.getCitationsForMessage(message.id)[0]?.originalName).toBe(
      "guide.pdf",
    );
  });
});
