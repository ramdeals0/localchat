import type {
  DocumentChunk,
  DocumentChunkWithScore,
  DocumentIndexStage,
  DocumentRecord,
  DocumentStatus,
  MessageCitation,
} from "@localchat/shared";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { cosineSimilarity } from "../rag/chunking.js";
import { getDatabase } from "./database.js";

interface DocumentRow {
  id: string;
  original_name: string;
  stored_name: string;
  mime_type: string | null;
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  imported_at: string;
  indexed_at: string | null;
  chunk_count: number;
  index_stage: string;
  index_progress_current: number;
  index_progress_total: number;
}

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
  content: string;
  embedding_json: string;
  created_at: string;
}

interface CitationRow {
  id: string;
  message_id: string;
  chunk_id: string;
  document_id: string;
  original_name: string;
  page_number: number | null;
  chunk_index: number;
  content: string;
  similarity: number;
}

function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    status: row.status,
    errorMessage: row.error_message,
    importedAt: row.imported_at,
    indexedAt: row.indexed_at,
    chunkCount: row.chunk_count,
    indexStage: (row.index_stage ?? "") as DocumentIndexStage,
    indexProgressCurrent: row.index_progress_current ?? 0,
    indexProgressTotal: row.index_progress_total ?? 0,
  };
}

function mapChunk(row: ChunkRow): DocumentChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    pageNumber: row.page_number,
    charStart: row.char_start,
    charEnd: row.char_end,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapCitation(row: CitationRow): MessageCitation {
  return {
    id: row.id,
    messageId: row.message_id,
    chunkId: row.chunk_id,
    documentId: row.document_id,
    originalName: row.original_name,
    pageNumber: row.page_number,
    chunkIndex: row.chunk_index,
    content: row.content,
    similarity: row.similarity,
  };
}

export interface StoredChunkInput {
  chunkIndex: number;
  pageNumber: number | null;
  charStart: number | null;
  charEnd: number | null;
  content: string;
  embedding: number[];
}

export class DocumentRepository {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  listDocuments(search?: string): DocumentRecord[] {
    const rows = search?.trim()
      ? (this.db
          .prepare(
            `SELECT * FROM documents
             WHERE original_name LIKE @search
             ORDER BY imported_at DESC`,
          )
          .all({ search: `%${search.trim()}%` }) as DocumentRow[])
      : (this.db
          .prepare(`SELECT * FROM documents ORDER BY imported_at DESC`)
          .all() as DocumentRow[]);

    return rows.map(mapDocument);
  }

  getDocument(id: string): DocumentRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM documents WHERE id = ?`)
      .get(id) as DocumentRow | undefined;
    return row ? mapDocument(row) : null;
  }

  createDocument(input: {
    id?: string;
    originalName: string;
    storedName: string;
    mimeType: string | null;
    fileSize: number;
  }): DocumentRecord {
    const now = new Date().toISOString();
    const document: DocumentRecord = {
      id: input.id ?? randomUUID(),
      originalName: input.originalName,
      storedName: input.storedName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      status: "queued",
      errorMessage: null,
      importedAt: now,
      indexedAt: null,
      chunkCount: 0,
      indexStage: "",
      indexProgressCurrent: 0,
      indexProgressTotal: 0,
    };

    this.db
      .prepare(
        `INSERT INTO documents (
          id, original_name, stored_name, mime_type, file_size, status,
          error_message, imported_at, indexed_at, chunk_count,
          index_stage, index_progress_current, index_progress_total
        ) VALUES (
          @id, @originalName, @storedName, @mimeType, @fileSize, @status,
          @errorMessage, @importedAt, @indexedAt, @chunkCount,
          @indexStage, @indexProgressCurrent, @indexProgressTotal
        )`,
      )
      .run(document);

    return document;
  }

  updateDocumentStatus(
    id: string,
    status: DocumentStatus,
    fields: {
      errorMessage?: string | null;
      indexedAt?: string | null;
      chunkCount?: number;
    } = {},
  ): DocumentRecord | null {
    const existing = this.getDocument(id);
    if (!existing) {
      return null;
    }

    const updated: DocumentRecord = {
      ...existing,
      status,
      errorMessage:
        fields.errorMessage !== undefined
          ? fields.errorMessage
          : existing.errorMessage,
      indexedAt:
        fields.indexedAt !== undefined ? fields.indexedAt : existing.indexedAt,
      chunkCount:
        fields.chunkCount !== undefined
          ? fields.chunkCount
          : existing.chunkCount,
      indexStage:
        status === "ready" || status === "failed" || status === "queued"
          ? ""
          : existing.indexStage,
      indexProgressCurrent:
        status === "ready" || status === "failed" || status === "queued"
          ? 0
          : existing.indexProgressCurrent,
      indexProgressTotal:
        status === "ready" || status === "failed" || status === "queued"
          ? 0
          : existing.indexProgressTotal,
    };

    this.db
      .prepare(
        `UPDATE documents
         SET status = @status, error_message = @errorMessage,
             indexed_at = @indexedAt, chunk_count = @chunkCount,
             index_stage = @indexStage,
             index_progress_current = @indexProgressCurrent,
             index_progress_total = @indexProgressTotal
         WHERE id = @id`,
      )
      .run(updated);

    return updated;
  }

  updateIndexProgress(
    id: string,
    progress: {
      stage: DocumentIndexStage;
      current?: number;
      total?: number;
    },
  ): DocumentRecord | null {
    const existing = this.getDocument(id);
    if (!existing) {
      return null;
    }

    const updated: DocumentRecord = {
      ...existing,
      indexStage: progress.stage,
      indexProgressCurrent: progress.current ?? existing.indexProgressCurrent,
      indexProgressTotal: progress.total ?? existing.indexProgressTotal,
    };

    this.db
      .prepare(
        `UPDATE documents
         SET index_stage = @indexStage,
             index_progress_current = @indexProgressCurrent,
             index_progress_total = @indexProgressTotal
         WHERE id = @id`,
      )
      .run({
        id: updated.id,
        indexStage: updated.indexStage,
        indexProgressCurrent: updated.indexProgressCurrent,
        indexProgressTotal: updated.indexProgressTotal,
      });

    return updated;
  }

  deleteDocument(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  deleteChunksForDocument(documentId: string): number {
    const result = this.db
      .prepare(`DELETE FROM document_chunks WHERE document_id = ?`)
      .run(documentId);
    return result.changes;
  }

  insertChunks(documentId: string, chunks: StoredChunkInput[]): number {
    const now = new Date().toISOString();
    const insert = this.db.prepare(
      `INSERT INTO document_chunks (
        id, document_id, chunk_index, page_number, char_start, char_end,
        content, embedding_json, created_at
      ) VALUES (
        @id, @documentId, @chunkIndex, @pageNumber, @charStart, @charEnd,
        @content, @embeddingJson, @createdAt
      )`,
    );

    const insertMany = this.db.transaction((items: StoredChunkInput[]) => {
      for (const chunk of items) {
        insert.run({
          id: randomUUID(),
          documentId,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          content: chunk.content,
          embeddingJson: JSON.stringify(chunk.embedding),
          createdAt: now,
        });
      }
    });

    insertMany(chunks);
    return chunks.length;
  }

  listChunks(documentId: string): DocumentChunk[] {
    const rows = this.db
      .prepare(
        `SELECT id, document_id, chunk_index, page_number, char_start, char_end,
                content, embedding_json, created_at
         FROM document_chunks
         WHERE document_id = ?
         ORDER BY chunk_index ASC`,
      )
      .all(documentId) as ChunkRow[];

    return rows.map(mapChunk);
  }

  getChunk(id: string): (DocumentChunk & { embedding: number[]; originalName: string }) | null {
    const row = this.db
      .prepare(
        `SELECT c.id, c.document_id, c.chunk_index, c.page_number, c.char_start,
                c.char_end, c.content, c.embedding_json, c.created_at, d.original_name
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE c.id = ?`,
      )
      .get(id) as (ChunkRow & { original_name: string }) | undefined;

    if (!row) {
      return null;
    }

    return {
      ...mapChunk(row),
      originalName: row.original_name,
      embedding: JSON.parse(row.embedding_json) as number[],
    };
  }

  listReadyChunks(documentIds?: string[]): Array<DocumentChunk & {
    embedding: number[];
    originalName: string;
  }> {
    const rows = documentIds?.length
      ? (this.db
          .prepare(
            `SELECT c.id, c.document_id, c.chunk_index, c.page_number, c.char_start,
                    c.char_end, c.content, c.embedding_json, c.created_at, d.original_name
             FROM document_chunks c
             JOIN documents d ON d.id = c.document_id
             WHERE d.status = 'ready' AND d.id IN (${documentIds.map(() => "?").join(",")})
             ORDER BY d.original_name ASC, c.chunk_index ASC`,
          )
          .all(...documentIds) as Array<ChunkRow & { original_name: string }>)
      : (this.db
          .prepare(
            `SELECT c.id, c.document_id, c.chunk_index, c.page_number, c.char_start,
                    c.char_end, c.content, c.embedding_json, c.created_at, d.original_name
             FROM document_chunks c
             JOIN documents d ON d.id = c.document_id
             WHERE d.status = 'ready'
             ORDER BY d.original_name ASC, c.chunk_index ASC`,
          )
          .all() as Array<ChunkRow & { original_name: string }>);

    return rows.map((row) => ({
      ...mapChunk(row),
      originalName: row.original_name,
      embedding: JSON.parse(row.embedding_json) as number[],
    }));
  }

  searchChunks(
    queryEmbedding: number[],
    options: {
      documentIds?: string[];
      topK: number;
      minSimilarity: number;
    },
  ): DocumentChunkWithScore[] {
    const candidates = this.listReadyChunks(options.documentIds);

    const scored = candidates
      .map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        content: chunk.content,
        createdAt: chunk.createdAt,
        originalName: chunk.originalName,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((chunk) => chunk.similarity >= options.minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.topK);

    return scored;
  }

  saveCitations(
    messageId: string,
    citations: Omit<MessageCitation, "id">[],
  ): MessageCitation[] {
    const insert = this.db.prepare(
      `INSERT INTO message_citations (
        id, message_id, chunk_id, document_id, original_name, page_number,
        chunk_index, content, similarity
      ) VALUES (
        @id, @messageId, @chunkId, @documentId, @originalName, @pageNumber,
        @chunkIndex, @content, @similarity
      )`,
    );

    const saved: MessageCitation[] = [];
    for (const citation of citations) {
      const row: MessageCitation = { id: randomUUID(), ...citation };
      insert.run(row);
      saved.push(row);
    }
    return saved;
  }

  getCitationsForMessage(messageId: string): MessageCitation[] {
    const rows = this.db
      .prepare(
        `SELECT id, message_id, chunk_id, document_id, original_name, page_number,
                chunk_index, content, similarity
         FROM message_citations
         WHERE message_id = ?
         ORDER BY similarity DESC`,
      )
      .all(messageId) as CitationRow[];

    return rows.map(mapCitation);
  }

  getCitationsForMessages(messageIds: string[]): Map<string, MessageCitation[]> {
    if (messageIds.length === 0) {
      return new Map();
    }

    const rows = this.db
      .prepare(
        `SELECT id, message_id, chunk_id, document_id, original_name, page_number,
                chunk_index, content, similarity
         FROM message_citations
         WHERE message_id IN (${messageIds.map(() => "?").join(",")})
         ORDER BY similarity DESC`,
      )
      .all(...messageIds) as CitationRow[];

    const map = new Map<string, MessageCitation[]>();
    for (const row of rows) {
      const citation = mapCitation(row);
      const existing = map.get(citation.messageId) ?? [];
      existing.push(citation);
      map.set(citation.messageId, existing);
    }
    return map;
  }
}
