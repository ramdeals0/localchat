import { describe, expect, it } from "vitest";
import {
  buildRagContextBlock,
  citationsToMessageCitations,
  formatCitationLabel,
} from "../src/rag/context.js";

describe("RAG context formatting", () => {
  it("formats citation labels with page numbers", () => {
    expect(
      formatCitationLabel({
        originalName: "filename.pdf",
        pageNumber: 4,
        chunkIndex: 12,
      }),
    ).toBe("[Source: filename.pdf, page 4, chunk 12]");
  });

  it("builds bounded context with source identifiers", () => {
    const context = buildRagContextBlock([
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 3,
        pageNumber: 2,
        charStart: 0,
        charEnd: 20,
        content: "Local refund policy details",
        createdAt: "2026-01-01",
        originalName: "policy.pdf",
        similarity: 0.78,
      },
    ]);

    expect(context).toContain("local document library");
    expect(context).toContain("brief summary plus short quoted snippets");
    expect(context).toContain("[Source: policy.pdf, page 2, chunk 3]");
    expect(context).toContain("Local refund policy details");
  });

  it("maps search results to message citations", () => {
    const citations = citationsToMessageCitations("message-1", [
      {
        id: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 1,
        pageNumber: null,
        charStart: 0,
        charEnd: 10,
        content: "hello",
        createdAt: "2026-01-01",
        originalName: "notes.txt",
        similarity: 0.66,
      },
    ]);

    expect(citations[0]).toMatchObject({
      messageId: "message-1",
      chunkId: "chunk-1",
      originalName: "notes.txt",
    });
  });
});
