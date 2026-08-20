import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../config.js";
import { migrateSearchFts } from "./search-migration.js";
import { migrateDocumentChunkSearchFts } from "./document-search-migration.js";

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  imported_at TEXT NOT NULL,
  indexed_at TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  index_stage TEXT NOT NULL DEFAULT '',
  index_progress_current INTEGER NOT NULL DEFAULT 0,
  index_progress_total INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  content TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
ON document_chunks(document_id);

CREATE TABLE IF NOT EXISTS message_citations (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  similarity REAL NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_citations_message_id
ON message_citations(message_id);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Custom',
  tags_json TEXT NOT NULL DEFAULT '[]',
  system_prompt TEXT,
  user_prompt_template TEXT NOT NULL,
  variables_json TEXT NOT NULL DEFAULT '[]',
  default_model TEXT,
  default_temperature REAL,
  rag_enabled INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_title ON prompt_templates(title);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_pinned ON prompt_templates(is_pinned, last_used_at);
`;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = path.resolve(appConfig.databasePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(path.resolve(appConfig.documentsPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrateDatabase(db);
  migratePromptTemplates(db);
  migrateSearchFts(db);
  migrateDocumentChunkSearchFts(db);

  return db;
}

function migrateDatabase(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(documents)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("index_stage")) {
    database.exec(
      "ALTER TABLE documents ADD COLUMN index_stage TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!names.has("index_progress_current")) {
    database.exec(
      "ALTER TABLE documents ADD COLUMN index_progress_current INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!names.has("index_progress_total")) {
    database.exec(
      "ALTER TABLE documents ADD COLUMN index_progress_total INTEGER NOT NULL DEFAULT 0",
    );
  }
}

function migratePromptTemplates(database: Database.Database): void {
  const table = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prompt_templates'",
    )
    .get() as { name: string } | undefined;

  if (!table) {
    return;
  }

  const columns = database
    .prepare("PRAGMA table_info(prompt_templates)")
    .all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));

  if (names.has("is_pinned")) {
    return;
  }

  if (!names.has("pinned")) {
    return;
  }

  database.exec(`
    CREATE TABLE prompt_templates_migrated (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Custom',
      tags_json TEXT NOT NULL DEFAULT '[]',
      system_prompt TEXT,
      user_prompt_template TEXT NOT NULL,
      variables_json TEXT NOT NULL DEFAULT '[]',
      default_model TEXT,
      default_temperature REAL,
      rag_enabled INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );

    INSERT INTO prompt_templates_migrated (
      id, title, description, category, tags_json, system_prompt, user_prompt_template,
      variables_json, default_model, default_temperature, rag_enabled, is_pinned,
      is_archived, usage_count, created_at, updated_at, last_used_at
    )
    SELECT
      id,
      title,
      NULLIF(description, ''),
      CASE WHEN category = '' THEN 'Custom' ELSE category END,
      tags_json,
      NULLIF(system_prompt, ''),
      CASE WHEN user_prompt_template = '' THEN title ELSE user_prompt_template END,
      '[]',
      default_model,
      temperature,
      rag_default,
      pinned,
      archived,
      usage_count,
      datetime(created_at / 1000, 'unixepoch'),
      datetime(updated_at / 1000, 'unixepoch'),
      NULL
    FROM prompt_templates;

    DROP TABLE prompt_templates;
    ALTER TABLE prompt_templates_migrated RENAME TO prompt_templates;

    CREATE INDEX IF NOT EXISTS idx_prompt_templates_title ON prompt_templates(title);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
    CREATE INDEX IF NOT EXISTS idx_prompt_templates_pinned ON prompt_templates(is_pinned, last_used_at);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** Reset singleton — for tests only. */
export function resetDatabaseForTests(): void {
  closeDatabase();
}
