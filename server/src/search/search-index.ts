import type Database from "better-sqlite3";
import { backfillSearchFts, isFts5Available } from "../db/search-migration.js";
import { getDatabase } from "../db/database.js";
import type { SearchRebuildResponse } from "@localchat/shared";

export class SearchIndexService {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  isAvailable(): boolean {
    return isFts5Available(this.db);
  }

  rebuildAll(): SearchRebuildResponse {
    if (!this.isAvailable()) {
      throw new Error("FTS5 is unavailable in this SQLite build");
    }

    const started = Date.now();
    const counts = this.db.transaction(() => backfillSearchFts(this.db))();
    return {
      ...counts,
      durationMs: Date.now() - started,
    };
  }
}
