import type { DocumentChunkWithScore, RagSearchResult } from "@localchat/shared";
import { appConfig } from "../config.js";
import { DocumentRepository } from "../db/document-repository.js";
import { buildRagContextBlock } from "../rag/context.js";
import { ollamaClient } from "../ollama/client.js";

export class RagService {
  constructor(
    private readonly documents = new DocumentRepository(),
    private readonly topK = appConfig.ragTopK,
    private readonly minSimilarity = appConfig.ragMinSimilarity,
  ) {}

  async search(
    query: string,
    documentIds?: string[],
  ): Promise<RagSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { query: trimmed, results: [], noRelevantSources: true };
    }

    if (!appConfig.ragEnabled) {
      return { query: trimmed, results: [], noRelevantSources: true };
    }

    const status = await ollamaClient.getStatus();
    if (!status.online) {
      throw new Error("Ollama is unavailable");
    }
    if (!status.embeddingModelAvailable) {
      throw new Error(
        `Embedding model "${appConfig.embeddingModel}" is not installed`,
      );
    }

    const queryEmbedding = await ollamaClient.embedText(trimmed);
    const results = this.documents.searchChunks(queryEmbedding, {
      documentIds,
      topK: this.topK,
      minSimilarity: this.minSimilarity,
    });

    return {
      query: trimmed,
      results,
      noRelevantSources: results.length === 0,
    };
  }

  buildContext(results: DocumentChunkWithScore[]): string {
    return buildRagContextBlock(results);
  }
}

export const ragService = new RagService();
