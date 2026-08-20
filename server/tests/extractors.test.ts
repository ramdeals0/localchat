import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractTextFromFile } from "../src/rag/extractors.js";

describe("text extraction", () => {
  const tempFiles: string[] = [];

  afterEach(() => {
    for (const file of tempFiles.splice(0)) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  function writeTemp(name: string, content: string): string {
    const filePath = path.join(os.tmpdir(), name);
    fs.writeFileSync(filePath, content, "utf8");
    tempFiles.push(filePath);
    return filePath;
  }

  it("extracts txt and md as UTF-8 text", async () => {
    const txt = writeTemp("sample.txt", "Plain text document");
    const md = writeTemp("sample.md", "# Heading\nBody");

    await expect(extractTextFromFile(txt, "txt")).resolves.toMatchObject({
      fullText: "Plain text document",
    });
    await expect(extractTextFromFile(md, "md")).resolves.toMatchObject({
      fullText: expect.stringContaining("Heading"),
    });
  });

  it("extracts csv into readable rows", async () => {
    const csv = writeTemp(
      "sample.csv",
      "name,role\nAlice,Engineer\nBob,Designer\n",
    );

    const result = await extractTextFromFile(csv, "csv");
    expect(result.fullText).toContain("Alice");
    expect(result.fullText).toContain("Engineer");
  });

  it("extracts json into formatted text", async () => {
    const json = writeTemp("sample.json", '{"title":"LocalChat","offline":true}');
    const result = await extractTextFromFile(json, "json");
    expect(result.fullText).toContain('"offline": true');
  });
});
