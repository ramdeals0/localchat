import { describe, expect, it, vi } from "vitest";
import { buildOllamaEmbedRequest } from "../src/rag/context.js";
import { RagService } from "../src/rag/retriever.js";

describe("RAG retrieval failures", () => {
  it("formats Ollama embedding requests", () => {
    expect(buildOllamaEmbedRequest("nomic-embed-text", "hello")).toEqual({
      model: "nomic-embed-text",
      prompt: "hello",
    });
  });

  it("throws when Ollama is unavailable", async () => {
    const service = new RagService();
    vi.spyOn(
      (await import("../src/ollama/client.js")).ollamaClient,
      "getStatus",
    ).mockResolvedValue({
      online: false,
      defaultModel: "qwen2.5:7b",
      selectedModelAvailable: false,
      embeddingModelAvailable: false,
      embeddingModel: "nomic-embed-text",
      models: [],
      error: "Ollama unavailable",
    });

    await expect(service.search("refund policy")).rejects.toThrow(
      "Ollama is unavailable",
    );
  });

  it("throws when embedding model is missing", async () => {
    const service = new RagService();
    vi.spyOn(
      (await import("../src/ollama/client.js")).ollamaClient,
      "getStatus",
    ).mockResolvedValue({
      online: true,
      defaultModel: "qwen2.5:7b",
      selectedModelAvailable: true,
      embeddingModelAvailable: false,
      embeddingModel: "nomic-embed-text",
      models: [{ name: "qwen2.5:7b" }],
    });

    await expect(service.search("refund policy")).rejects.toThrow(
      "Embedding model",
    );
  });
});
