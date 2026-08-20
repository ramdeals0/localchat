import { describe, expect, it } from "vitest";
import type { DocumentRecord } from "@localchat/shared";
import {
  getIndexingProgressLabel,
  getIndexingProgressPercent,
} from "../IndexingProgress";

function doc(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: "1",
    originalName: "notes.txt",
    storedName: "1.txt",
    mimeType: "text/plain",
    fileSize: 100,
    status: "processing",
    errorMessage: null,
    importedAt: new Date().toISOString(),
    indexedAt: null,
    chunkCount: 0,
    indexStage: "",
    indexProgressCurrent: 0,
    indexProgressTotal: 0,
    ...overrides,
  };
}

describe("IndexingProgress helpers", () => {
  it("shows embedding chunk progress", () => {
    const document = doc({
      indexStage: "embedding",
      indexProgressCurrent: 2,
      indexProgressTotal: 5,
    });
    expect(getIndexingProgressLabel(document)).toBe("Embedding chunk 2 of 5");
    expect(getIndexingProgressPercent(document)).toBe(40);
  });

  it("shows queued state as indeterminate", () => {
    const document = doc({ status: "queued" });
    expect(getIndexingProgressLabel(document)).toBe("Waiting to start…");
    expect(getIndexingProgressPercent(document)).toBeNull();
  });
});
