import type {
  MessageRole,
  SearchEntityType,
  SearchHit,
  SearchResponse,
} from "@localchat/shared";
import {
  buildFallbackSnippet,
  parseHighlightedSnippet,
  type ParsedSearchParams,
} from "@localchat/shared";
import type Database from "better-sqlite3";
import { getDatabase } from "../db/database.js";
import { isFts5Available } from "../db/search-migration.js";

interface RawSearchRow {
  entity_type: SearchEntityType;
  entity_id: string;
  conversation_id: string | null;
  conversation_title: string | null;
  role: string | null;
  model: string | null;
  has_citation: number;
  created_at: number;
  title: string;
  body: string;
  highlighted: string;
  rank: number;
}

export class FtsUnavailableError extends Error {
  constructor() {
    super("Full-text search is unavailable in this SQLite build");
    this.name = "FtsUnavailableError";
  }
}

export class SearchRepository {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  search(input: ParsedSearchParams): SearchResponse {
    if (!isFts5Available(this.db)) {
      throw new FtsUnavailableError();
    }

    const unions: string[] = [];
    const params: Record<string, unknown> = {
      ftsQuery: input.ftsQuery,
    };

    if (input.conversationId) {
      params.conversationId = input.conversationId;
    }
    if (input.role) {
      params.role = input.role;
    }
    if (input.model) {
      params.model = input.model;
    }
    if (input.fromMs !== undefined) {
      params.fromMs = input.fromMs;
    }
    if (input.toMs !== undefined) {
      params.toMs = input.toMs;
    }

    if (input.types.includes("conversation")) {
      unions.push(this.conversationSelect(input));
    }
    if (input.types.includes("message")) {
      unions.push(this.messageSelect(input));
    }
    if (input.types.includes("prompt")) {
      unions.push(this.promptSelect(input));
    }

    if (unions.length === 0) {
      return { query: input.q, total: 0, hits: [] };
    }

    const unionSql = unions.join("\nUNION ALL\n");
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS total FROM (${unionSql})`)
      .get(params) as { total: number };

    params.limit = input.limit;
    params.offset = input.offset;

    const rows = this.db
      .prepare(
        `SELECT * FROM (${unionSql})
         ORDER BY rank ASC
         LIMIT @limit OFFSET @offset`,
      )
      .all(params) as RawSearchRow[];

    const hits: SearchHit[] = rows.map((row) => {
      const fallback = buildFallbackSnippet(row.body, input.q);
      const highlighted = parseHighlightedSnippet(row.highlighted, fallback);
      return {
        entityType: row.entity_type,
        entityId: row.entity_id,
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title,
        title: row.title,
        snippet: highlighted.snippet,
        snippetParts: highlighted.snippetParts,
        role: row.role as MessageRole | null,
        model: row.model,
        hasCitation: row.has_citation === 1,
        createdAt: row.created_at,
        rank: row.rank,
      };
    });

    return {
      query: input.q,
      total: countRow.total,
      hits,
    };
  }

  private conversationSelect(input: ParsedSearchParams): string {
    const conditions = ["conversation_search_fts MATCH @ftsQuery"];
    if (input.conversationId) {
      conditions.push("c.id = @conversationId");
    }
    if (input.model) {
      conditions.push("c.model = @model");
    }
    if (input.fromMs !== undefined) {
      conditions.push("c.updated_at >= @fromMs");
    }
    if (input.toMs !== undefined) {
      conditions.push("c.updated_at <= @toMs");
    }
    if (input.role || input.hasCitations !== undefined) {
      conditions.push("1 = 0");
    }

    return `
      SELECT
        'conversation' AS entity_type,
        c.id AS entity_id,
        c.id AS conversation_id,
        c.title AS conversation_title,
        NULL AS role,
        c.model AS model,
        0 AS has_citation,
        c.updated_at AS created_at,
        c.title AS title,
        c.title AS body,
        highlight(conversation_search_fts, 0, '<mark>', '</mark>') AS highlighted,
        bm25(conversation_search_fts) AS rank
      FROM conversation_search_fts
      JOIN conversations c ON c.rowid = conversation_search_fts.rowid
      WHERE ${conditions.join(" AND ")}
    `;
  }

  private messageSelect(input: ParsedSearchParams): string {
    const conditions = ["message_search_fts MATCH @ftsQuery"];
    if (input.conversationId) {
      conditions.push("m.conversation_id = @conversationId");
    }
    if (input.role) {
      conditions.push("m.role = @role");
    }
    if (input.model) {
      conditions.push("c.model = @model");
    }
    if (input.fromMs !== undefined) {
      conditions.push("m.created_at >= @fromMs");
    }
    if (input.toMs !== undefined) {
      conditions.push("m.created_at <= @toMs");
    }
    if (input.hasCitations === true) {
      conditions.push(
        "EXISTS (SELECT 1 FROM message_citations mc WHERE mc.message_id = m.id)",
      );
    } else if (input.hasCitations === false) {
      conditions.push(
        "NOT EXISTS (SELECT 1 FROM message_citations mc WHERE mc.message_id = m.id)",
      );
    }

    return `
      SELECT
        'message' AS entity_type,
        m.id AS entity_id,
        m.conversation_id AS conversation_id,
        c.title AS conversation_title,
        m.role AS role,
        c.model AS model,
        CASE
          WHEN EXISTS (SELECT 1 FROM message_citations mc WHERE mc.message_id = m.id) THEN 1
          ELSE 0
        END AS has_citation,
        m.created_at AS created_at,
        c.title AS title,
        m.content AS body,
        snippet(message_search_fts, 0, '<mark>', '</mark>', '…', 20) AS highlighted,
        bm25(message_search_fts) AS rank
      FROM message_search_fts
      JOIN messages m ON m.rowid = message_search_fts.rowid
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ${conditions.join(" AND ")}
    `;
  }

  private promptSelect(input: ParsedSearchParams): string {
    const conditions = [
      "prompt_search_fts MATCH @ftsQuery",
      "p.is_archived = 0",
    ];
    if (input.model) {
      conditions.push("p.default_model = @model");
    }
    if (input.fromMs !== undefined) {
      conditions.push("CAST(strftime('%s', p.updated_at) AS INTEGER) * 1000 >= @fromMs");
    }
    if (input.toMs !== undefined) {
      conditions.push("CAST(strftime('%s', p.updated_at) AS INTEGER) * 1000 <= @toMs");
    }
    if (input.conversationId || input.role || input.hasCitations !== undefined) {
      conditions.push("1 = 0");
    }

    return `
      SELECT
        'prompt' AS entity_type,
        p.id AS entity_id,
        NULL AS conversation_id,
        NULL AS conversation_title,
        NULL AS role,
        p.default_model AS model,
        0 AS has_citation,
        CAST(strftime('%s', p.updated_at) AS INTEGER) * 1000 AS created_at,
        p.title AS title,
        trim(
          coalesce(p.title, '') || ' ' ||
          coalesce(p.description, '') || ' ' ||
          coalesce(p.category, '') || ' ' ||
          coalesce(p.tags_json, '') || ' ' ||
          coalesce(p.system_prompt, '') || ' ' ||
          coalesce(p.user_prompt_template, '')
        ) AS body,
        snippet(prompt_search_fts, 0, '<mark>', '</mark>', '…', 20) AS highlighted,
        bm25(prompt_search_fts) AS rank
      FROM prompt_search_fts
      JOIN prompt_templates p ON p.rowid = prompt_search_fts.rowid
      WHERE ${conditions.join(" AND ")}
    `;
  }
}
