import { describe, expect, it } from "vitest";
import {
  buildFallbackSnippet,
  normalizeFtsQuery,
  parseHighlightedSnippet,
  parseSearchParams,
} from "@localchat/shared";

describe("search query utilities", () => {
  it("normalizes user text into safe quoted FTS terms", () => {
    expect(normalizeFtsQuery('hello "world"')).toBe('"hello" "world"');
    expect(normalizeFtsQuery("Tauri* OR sidecar")).toBe('"Tauri" "OR" "sidecar"');
  });

  it("rejects empty and invalid search params", () => {
    expect(parseSearchParams({ q: "   " })).toEqual([
      { field: "q", message: "Query parameter q is required" },
    ]);
    expect(parseSearchParams({ q: "hello", limit: "200" })).toEqual([
      { field: "limit", message: "limit must be an integer between 1 and 100" },
    ]);
    expect(parseSearchParams({ q: "hello", types: "message,invalid" })).toEqual([
      {
        field: "types",
        message: 'Invalid search type "invalid". Use conversation, message, or prompt.',
      },
    ]);
  });

  it("parses valid filters and limits", () => {
    const parsed = parseSearchParams({
      q: "offline",
      types: "message,prompt",
      role: "assistant",
      hasCitations: "true",
      from: "2026-01-01T00:00:00.000Z",
      limit: "10",
      offset: "5",
    });
    expect(Array.isArray(parsed)).toBe(false);
    if (!Array.isArray(parsed)) {
      expect(parsed.types).toEqual(["message", "prompt"]);
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(5);
      expect(parsed.hasCitations).toBe(true);
    }
  });

  it("parses highlighted snippets into structured parts", () => {
    const parsed = parseHighlightedSnippet(
      "Use <mark>Tauri</mark> with a local sidecar",
      "fallback",
    );
    expect(parsed.snippet).toContain("Tauri");
    expect(parsed.snippetParts.some((part) => part.match && part.text === "Tauri")).toBe(true);
  });

  it("builds fallback snippets without HTML", () => {
    const snippet = buildFallbackSnippet(
      "LocalChat packages offline search with SQLite FTS5.",
      "offline search",
    );
    expect(snippet.toLowerCase()).toContain("offline");
    expect(snippet).not.toContain("<");
  });
});
