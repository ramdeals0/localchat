import type Database from "better-sqlite3";

const FTS5_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_search_fts USING fts5(
  title,
  content='conversations',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS message_search_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS prompt_search_fts USING fts5(
  title,
  description,
  category,
  tags_json,
  system_prompt,
  user_prompt_template,
  content='prompt_templates',
  content_rowid='rowid',
  tokenize='unicode61'
);
`;

const FTS5_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS conversation_search_fts_insert
AFTER INSERT ON conversations BEGIN
  INSERT INTO conversation_search_fts(rowid, title)
  VALUES (new.rowid, new.title);
END;

CREATE TRIGGER IF NOT EXISTS conversation_search_fts_delete
AFTER DELETE ON conversations BEGIN
  INSERT INTO conversation_search_fts(conversation_search_fts, rowid, title)
  VALUES ('delete', old.rowid, old.title);
END;

CREATE TRIGGER IF NOT EXISTS conversation_search_fts_update
AFTER UPDATE ON conversations BEGIN
  INSERT INTO conversation_search_fts(conversation_search_fts, rowid, title)
  VALUES ('delete', old.rowid, old.title);
  INSERT INTO conversation_search_fts(rowid, title)
  VALUES (new.rowid, new.title);
END;

CREATE TRIGGER IF NOT EXISTS message_search_fts_insert
AFTER INSERT ON messages BEGIN
  INSERT INTO message_search_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS message_search_fts_delete
AFTER DELETE ON messages BEGIN
  INSERT INTO message_search_fts(message_search_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS message_search_fts_update
AFTER UPDATE ON messages BEGIN
  INSERT INTO message_search_fts(message_search_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO message_search_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS prompt_search_fts_insert
AFTER INSERT ON prompt_templates BEGIN
  INSERT INTO prompt_search_fts(
    rowid, title, description, category, tags_json, system_prompt, user_prompt_template
  )
  VALUES (
    new.rowid,
    new.title,
    coalesce(new.description, ''),
    new.category,
    new.tags_json,
    coalesce(new.system_prompt, ''),
    new.user_prompt_template
  );
END;

CREATE TRIGGER IF NOT EXISTS prompt_search_fts_delete
AFTER DELETE ON prompt_templates BEGIN
  INSERT INTO prompt_search_fts(
    prompt_search_fts, rowid, title, description, category, tags_json, system_prompt, user_prompt_template
  )
  VALUES (
    'delete',
    old.rowid,
    old.title,
    coalesce(old.description, ''),
    old.category,
    old.tags_json,
    coalesce(old.system_prompt, ''),
    old.user_prompt_template
  );
END;

CREATE TRIGGER IF NOT EXISTS prompt_search_fts_update
AFTER UPDATE ON prompt_templates BEGIN
  INSERT INTO prompt_search_fts(
    prompt_search_fts, rowid, title, description, category, tags_json, system_prompt, user_prompt_template
  )
  VALUES (
    'delete',
    old.rowid,
    old.title,
    coalesce(old.description, ''),
    old.category,
    old.tags_json,
    coalesce(old.system_prompt, ''),
    old.user_prompt_template
  );
  INSERT INTO prompt_search_fts(
    rowid, title, description, category, tags_json, system_prompt, user_prompt_template
  )
  VALUES (
    new.rowid,
    new.title,
    coalesce(new.description, ''),
    new.category,
    new.tags_json,
    coalesce(new.system_prompt, ''),
    new.user_prompt_template
  );
END;
`;

export function isFts5Available(database: Database.Database): boolean {
  try {
    database.exec("CREATE VIRTUAL TABLE IF NOT EXISTS _localchat_fts5_probe USING fts5(x)");
    database.exec("DROP TABLE IF EXISTS _localchat_fts5_probe");
    return true;
  } catch {
    return false;
  }
}

function hasSearchFtsTables(database: Database.Database): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversation_search_fts'",
    )
    .get() as { name: string } | undefined;
  return Boolean(row);
}

export function backfillSearchFts(database: Database.Database): {
  conversations: number;
  messages: number;
  prompts: number;
} {
  database.exec("INSERT INTO conversation_search_fts(conversation_search_fts) VALUES ('rebuild')");
  database.exec("INSERT INTO message_search_fts(message_search_fts) VALUES ('rebuild')");
  database.exec("INSERT INTO prompt_search_fts(prompt_search_fts) VALUES ('rebuild')");

  const conversations = (
    database.prepare("SELECT COUNT(*) AS count FROM conversation_search_fts").get() as {
      count: number;
    }
  ).count;
  const messages = (
    database.prepare("SELECT COUNT(*) AS count FROM message_search_fts").get() as { count: number }
  ).count;
  const prompts = (
    database.prepare("SELECT COUNT(*) AS count FROM prompt_search_fts").get() as { count: number }
  ).count;

  return { conversations, messages, prompts };
}

export function migrateSearchFts(database: Database.Database): void {
  if (!isFts5Available(database)) {
    return;
  }

  if (hasSearchFtsTables(database)) {
    return;
  }

  database.exec("DROP TABLE IF EXISTS local_search_fts");
  database.exec(FTS5_DDL);
  database.exec(FTS5_TRIGGERS);
  backfillSearchFts(database);
}
