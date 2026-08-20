import { describe, expect, it } from "vitest";
import { chunkExtractedText, cosineSimilarity } from "../src/rag/chunking.js";

describe("chunking and similarity", () => {
  it("creates overlapping chunks with metadata", () => {
    const chunks = chunkExtractedText(
      [{ text: "abcdefghijklmnopqrstuvwxyz", pageNumber: 2 }],
      10,
      3,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      pageNumber: 2,
      charStart: 0,
    });
    expect(chunks[1]?.charStart).toBeLessThan(chunks[0]?.charEnd ?? 0);
  });

  it("preserves page numbers from segments", () => {
    const chunks = chunkExtractedText(
      [
        { text: "Page one content here", pageNumber: 1 },
        { text: "Page two content here", pageNumber: 2 },
      ],
      12,
      2,
    );

    expect(chunks.some((chunk) => chunk.pageNumber === 1)).toBe(true);
    expect(chunks.some((chunk) => chunk.pageNumber === 2)).toBe(true);
  });

  it("ranks vectors by cosine similarity and filters low scores", () => {
    const query = [1, 0, 0];
    const close = cosineSimilarity(query, [0.9, 0.1, 0]);
    const far = cosineSimilarity(query, [0, 1, 0]);

    expect(close).toBeGreaterThan(0.9);
    expect(far).toBeLessThan(0.35);
  });
});
