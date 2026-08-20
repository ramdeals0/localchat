import type Database from "better-sqlite3";
import { isFts5Available } from "./search-migration.js";

const DOCUMENT_CHUNK_FTS_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS document_chunk_search_fts USING fts5(
  content,
  content='document_chunks',
  content_rowid='rowid',
  tokenize='unicode61'
);
`;

const DOCUMENT_CHUNK_FTS_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS document_chunk_search_fts_insert
AFTER INSERT ON document_chunks BEGIN
  INSERT INTO document_chunk_search_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS document_chunk_search_fts_delete
AFTER DELETE ON document_chunks BEGIN
  INSERT INTO document_chunk_search_fts(document_chunk_search_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS document_chunk_search_fts_update
AFTER UPDATE ON document_chunks BEGIN
  INSERT INTO document_chunk_search_fts(document_chunk_search_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO document_chunk_search_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;
`;

function hasDocumentChunkSearchFts(database: Database.Database): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_chunk_search_fts'",
    )
    .get() as { name: string } | undefined;
  return Boolean(row);
}

export function backfillDocumentChunkSearchFts(database: Database.Database): number {
  database.exec(
    "INSERT INTO document_chunk_search_fts(document_chunk_search_fts) VALUES ('rebuild')",
  );
  return (
    database.prepare("SELECT COUNT(*) AS count FROM document_chunk_search_fts").get() as {
      count: number;
    }
  ).count;
}

export function migrateDocumentChunkSearchFts(database: Database.Database): void {
  if (!isFts5Available(database)) {
    return;
  }

  if (hasDocumentChunkSearchFts(database)) {
    return;
  }

  database.exec(DOCUMENT_CHUNK_FTS_DDL);
  database.exec(DOCUMENT_CHUNK_FTS_TRIGGERS);
  backfillDocumentChunkSearchFts(database);
}
