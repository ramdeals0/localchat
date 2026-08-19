import type {
  Conversation,
  ConversationWithMessages,
  CreateConversationRequest,
  Message,
  MessageRole,
  UpdateConversationRequest,
} from "@localchat/shared";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./database.js";

interface ConversationRow {
  id: string;
  title: string;
  system_prompt: string;
  model: string;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: number;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class ChatRepository {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  listConversations(): Conversation[] {
    const rows = this.db
      .prepare(
        `SELECT id, title, system_prompt, model, created_at, updated_at
         FROM conversations
         ORDER BY updated_at DESC`,
      )
      .all() as ConversationRow[];

    return rows.map(mapConversation);
  }

  getConversation(id: string): ConversationWithMessages | null {
    const row = this.db
      .prepare(
        `SELECT id, title, system_prompt, model, created_at, updated_at
         FROM conversations WHERE id = ?`,
      )
      .get(id) as ConversationRow | undefined;

    if (!row) {
      return null;
    }

    const messages = this.getMessages(id);
    return { ...mapConversation(row), messages };
  }

  createConversation(
    input: CreateConversationRequest,
    defaultModel: string,
  ): Conversation {
    const now = Date.now();
    const conversation: Conversation = {
      id: randomUUID(),
      title: input.title?.trim() || "New conversation",
      systemPrompt: input.systemPrompt ?? "",
      model: input.model ?? defaultModel,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO conversations (id, title, system_prompt, model, created_at, updated_at)
         VALUES (@id, @title, @systemPrompt, @model, @createdAt, @updatedAt)`,
      )
      .run({
        id: conversation.id,
        title: conversation.title,
        systemPrompt: conversation.systemPrompt,
        model: conversation.model,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });

    return conversation;
  }

  updateConversation(
    id: string,
    input: UpdateConversationRequest,
  ): Conversation | null {
    const existing = this.getConversation(id);
    if (!existing) {
      return null;
    }

    const updated: Conversation = {
      ...existing,
      title: input.title?.trim() || existing.title,
      systemPrompt:
        input.systemPrompt !== undefined
          ? input.systemPrompt
          : existing.systemPrompt,
      model: input.model ?? existing.model,
      updatedAt: Date.now(),
    };

    this.db
      .prepare(
        `UPDATE conversations
         SET title = @title, system_prompt = @systemPrompt, model = @model, updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id: updated.id,
        title: updated.title,
        systemPrompt: updated.systemPrompt,
        model: updated.model,
        updatedAt: updated.updatedAt,
      });

    return updated;
  }

  deleteConversation(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM conversations WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  touchConversation(id: string): void {
    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }

  getMessages(conversationId: string): Message[] {
    const rows = this.db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      )
      .all(conversationId) as MessageRow[];

    return rows.map(mapMessage);
  }

  addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
  ): Message {
    const message: Message = {
      id: randomUUID(),
      conversationId,
      role,
      content,
      createdAt: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at)
         VALUES (@id, @conversationId, @role, @content, @createdAt)`,
      )
      .run(message);

    this.touchConversation(conversationId);
    return message;
  }

  updateMessage(id: string, content: string): Message | null {
    const row = this.db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages WHERE id = ?`,
      )
      .get(id) as MessageRow | undefined;

    if (!row) {
      return null;
    }

    this.db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(content, id);
    this.touchConversation(row.conversation_id);

    return { ...mapMessage(row), content };
  }

  deleteMessage(id: string): boolean {
    const row = this.db
      .prepare("SELECT conversation_id FROM messages WHERE id = ?")
      .get(id) as { conversation_id: string } | undefined;

    if (!row) {
      return false;
    }

    const result = this.db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    if (result.changes > 0) {
      this.touchConversation(row.conversation_id);
    }
    return result.changes > 0;
  }

  deleteLastAssistantMessage(conversationId: string): Message | null {
    const row = this.db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ? AND role = 'assistant'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(conversationId) as MessageRow | undefined;

    if (!row) {
      return null;
    }

    this.deleteMessage(row.id);
    return mapMessage(row);
  }

  clearMessages(conversationId: string): number {
    const result = this.db
      .prepare("DELETE FROM messages WHERE conversation_id = ?")
      .run(conversationId);

    if (result.changes > 0) {
      this.touchConversation(conversationId);
    }

    return result.changes;
  }
}

export function conversationToMarkdown(
  conversation: ConversationWithMessages,
): string {
  const lines = [
    `# ${conversation.title}`,
    "",
    `> Model: ${conversation.model}`,
    conversation.systemPrompt
      ? `\n**System prompt:**\n\n${conversation.systemPrompt}\n`
      : "",
    "---",
    "",
  ];

  for (const message of conversation.messages) {
    const heading =
      message.role === "user"
        ? "You"
        : message.role === "assistant"
          ? "Assistant"
          : "System";
    lines.push(`## ${heading}`, "", message.content, "", "---", "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
