import { describe, expect, it } from "vitest";
import {
  buildStoredFilename,
  getFileExtension,
  isAllowedExtension,
  sanitizeOriginalFilename,
  validateMimeForExtension,
} from "../src/rag/file-validation.js";
import { resolveDocumentStoragePath } from "../src/rag/storage.js";

describe("file validation", () => {
  it("accepts supported extensions and rejects unsupported ones", () => {
    expect(isAllowedExtension("report.pdf")).toBe(true);
    expect(isAllowedExtension("notes.TXT")).toBe(true);
    expect(isAllowedExtension("script.exe")).toBe(false);
  });

  it("validates MIME types against extensions", () => {
    expect(validateMimeForExtension("report.pdf", "application/pdf")).toBe(true);
    expect(validateMimeForExtension("report.pdf", "text/plain")).toBe(false);
    expect(validateMimeForExtension("notes.txt", "application/octet-stream")).toBe(true);
  });

  it("sanitizes filenames and rejects path traversal", () => {
    expect(sanitizeOriginalFilename("../../secret.pdf")).toBe("secret.pdf");
    expect(getFileExtension("folder/data.csv")).toBe("csv");
  });

  it("builds UUID-based stored filenames", () => {
    expect(buildStoredFilename("abc-123", "My Doc.PDF")).toBe("abc-123.pdf");
  });

  it("blocks path traversal in storage resolution", () => {
    expect(() => resolveDocumentStoragePath("../outside.txt")).toThrow(
      "Invalid document storage path",
    );
  });
});
