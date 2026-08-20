import type Database from "better-sqlite3";
import { backfillDocumentChunkSearchFts } from "../db/document-search-migration.js";
import { getDatabase } from "../db/database.js";
import { isFts5Available } from "../db/search-migration.js";

export class DocumentSearchIndexService {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  isAvailable(): boolean {
    return isFts5Available(this.db);
  }

  rebuildAll(): { chunks: number; durationMs: number } {
    if (!this.isAvailable()) {
      throw new Error("FTS5 is unavailable in this SQLite build");
    }

    const started = Date.now();
    const chunks = this.db.transaction(() => backfillDocumentChunkSearchFts(this.db))();
    return {
      chunks,
      durationMs: Date.now() - started,
    };
  }
}
