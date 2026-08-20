import { appConfig } from "../config.js";
import { DocumentRepository } from "../db/document-repository.js";
import { chunkExtractedText } from "../rag/chunking.js";
import { extractTextFromFile } from "../rag/extractors.js";
import { getFileExtension } from "../rag/file-validation.js";
import { resolveDocumentStoragePath } from "../rag/storage.js";
import { ollamaClient } from "../ollama/client.js";

export class DocumentIndexer {
  constructor(
    private readonly documents = new DocumentRepository(),
    private readonly chunkSize = appConfig.ragChunkSize,
    private readonly chunkOverlap = appConfig.ragChunkOverlap,
  ) {}

  async indexDocument(documentId: string): Promise<void> {
    const document = this.documents.getDocument(documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    this.documents.updateDocumentStatus(documentId, "processing", {
      errorMessage: null,
    });
    this.documents.updateIndexProgress(documentId, {
      stage: "extracting",
      current: 0,
      total: 0,
    });

    try {
      const status = await ollamaClient.getStatus();
      if (!status.online) {
        throw new Error("Ollama is unavailable. Start Ollama and try again.");
      }
      if (!status.embeddingModelAvailable) {
        throw new Error(
          `Embedding model "${appConfig.embeddingModel}" is not installed. Run: ollama pull ${appConfig.embeddingModel}`,
        );
      }

      const extension = getFileExtension(document.originalName);
      if (!extension) {
        throw new Error("Document has no file extension");
      }

      const filePath = resolveDocumentStoragePath(document.storedName);
      const extracted = await extractTextFromFile(filePath, extension);
      if (!extracted.fullText.trim()) {
        throw new Error("No readable text could be extracted from this document");
      }

      this.documents.updateIndexProgress(documentId, {
        stage: "chunking",
        current: 0,
        total: 0,
      });

      const chunks = chunkExtractedText(
        extracted.segments,
        this.chunkSize,
        this.chunkOverlap,
      );

      if (chunks.length === 0) {
        throw new Error("Document produced no indexable chunks");
      }

      this.documents.deleteChunksForDocument(documentId);
      this.documents.updateIndexProgress(documentId, {
        stage: "embedding",
        current: 0,
        total: chunks.length,
      });

      const storedChunks = [];
      for (const [index, chunk] of chunks.entries()) {
        const embedding = await ollamaClient.embedText(chunk.content);
        storedChunks.push({
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          content: chunk.content,
          embedding,
        });
        this.documents.updateIndexProgress(documentId, {
          stage: "embedding",
          current: index + 1,
          total: chunks.length,
        });
      }

      this.documents.updateIndexProgress(documentId, {
        stage: "saving",
        current: chunks.length,
        total: chunks.length,
      });

      this.documents.insertChunks(documentId, storedChunks);
      this.documents.updateDocumentStatus(documentId, "ready", {
        errorMessage: null,
        indexedAt: new Date().toISOString(),
        chunkCount: storedChunks.length,
      });
    } catch (error) {
      this.documents.deleteChunksForDocument(documentId);
      this.documents.updateDocumentStatus(documentId, "failed", {
        errorMessage:
          error instanceof Error ? error.message : "Indexing failed",
        indexedAt: null,
        chunkCount: 0,
      });
      throw error;
    }
  }

  queueIndex(documentId: string): void {
    setImmediate(() => {
      void this.indexDocument(documentId).catch(() => {
        // Status is persisted inside indexDocument.
      });
    });
  }
}

export const documentIndexer = new DocumentIndexer();
