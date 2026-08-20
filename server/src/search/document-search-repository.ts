import type { DocumentSearchHit, DocumentSearchResponse } from "@localchat/shared";
import {
  buildFallbackSnippet,
  parseHighlightedSnippet,
  type ParsedDocumentSearchParams,
} from "@localchat/shared";
import type Database from "better-sqlite3";
import { getDatabase } from "../db/database.js";
import { isFts5Available } from "../db/search-migration.js";

interface RawDocumentSearchRow {
  chunk_id: string;
  document_id: string;
  original_name: string;
  chunk_index: number;
  page_number: number | null;
  content: string;
  highlighted: string;
  rank: number;
}

export class DocumentFtsUnavailableError extends Error {
  constructor() {
    super("Document full-text search is unavailable in this SQLite build");
    this.name = "DocumentFtsUnavailableError";
  }
}

export class DocumentSearchRepository {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  search(input: ParsedDocumentSearchParams): DocumentSearchResponse {
    if (!isFts5Available(this.db)) {
      throw new DocumentFtsUnavailableError();
    }

    const conditions = [
      "document_chunk_search_fts MATCH @ftsQuery",
      "d.status = 'ready'",
    ];
    const params: Record<string, unknown> = {
      ftsQuery: input.ftsQuery,
      limit: input.limit,
    };

    if (input.documentIds.length > 0) {
      const placeholders = input.documentIds.map((_, index) => `@docId${index}`);
      conditions.push(`d.id IN (${placeholders.join(", ")})`);
      for (const [index, documentId] of input.documentIds.entries()) {
        params[`docId${index}`] = documentId;
      }
    }

    const where = conditions.join(" AND ");
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM document_chunk_search_fts
         JOIN document_chunks c ON c.rowid = document_chunk_search_fts.rowid
         JOIN documents d ON d.id = c.document_id
         WHERE ${where}`,
      )
      .get(params) as { total: number };

    const rows = this.db
      .prepare(
        `SELECT
           c.id AS chunk_id,
           c.document_id,
           d.original_name,
           c.chunk_index,
           c.page_number,
           c.content,
           snippet(document_chunk_search_fts, 0, '<mark>', '</mark>', '…', 20) AS highlighted,
           bm25(document_chunk_search_fts) AS rank
         FROM document_chunk_search_fts
         JOIN document_chunks c ON c.rowid = document_chunk_search_fts.rowid
         JOIN documents d ON d.id = c.document_id
         WHERE ${where}
         ORDER BY rank ASC
         LIMIT @limit`,
      )
      .all(params) as RawDocumentSearchRow[];

    const hits: DocumentSearchHit[] = rows.map((row) => {
      const fallback = buildFallbackSnippet(row.content, input.q);
      const highlighted = parseHighlightedSnippet(row.highlighted, fallback);
      return {
        chunkId: row.chunk_id,
        documentId: row.document_id,
        originalName: row.original_name,
        chunkIndex: row.chunk_index,
        pageNumber: row.page_number,
        content: row.content,
        snippet: highlighted.snippet,
        snippetParts: highlighted.snippetParts,
        rank: row.rank,
      };
    });

    return {
      query: input.q,
      total: countRow.total,
      hits,
    };
  }
}
