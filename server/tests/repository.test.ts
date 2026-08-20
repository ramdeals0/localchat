import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabase,
  getDatabase,
  resetDatabaseForTests,
} from "../src/db/database.js";
import {
  ChatRepository,
  conversationToMarkdown,
} from "../src/db/repository.js";

describe("ChatRepository", () => {
  let dbPath: string;
  let repo: ChatRepository;

  beforeEach(() => {
    resetDatabaseForTests();
    dbPath = path.join(
      os.tmpdir(),
      `localchat-test-${Date.now()}-${Math.random()}.db`,
    );
    process.env.DATABASE_PATH = dbPath;

    repo = new ChatRepository(getDatabase());
  });

  afterEach(() => {
    closeDatabase();
    resetDatabaseForTests();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    delete process.env.DATABASE_PATH;
  });

  it("creates and lists conversations", () => {
    const created = repo.createConversation(
      { title: "Test chat", systemPrompt: "Be helpful" },
      "qwen2.5:7b",
    );

    const list = repo.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);
    expect(list[0]?.title).toBe("Test chat");
    expect(list[0]?.systemPrompt).toBe("Be helpful");
  });

  it("adds messages and retrieves conversation with messages", () => {
    const conversation = repo.createConversation({}, "qwen2.5:7b");
    repo.addMessage(conversation.id, "user", "Hello");
    repo.addMessage(conversation.id, "assistant", "Hi there");

    const loaded = repo.getConversation(conversation.id);
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[0]?.role).toBe("user");
    expect(loaded?.messages[1]?.content).toBe("Hi there");
  });

  it("updates and deletes conversations", () => {
    const conversation = repo.createConversation({ title: "Old" }, "qwen2.5:7b");
    const updated = repo.updateConversation(conversation.id, {
      title: "New title",
      systemPrompt: "Updated prompt",
    });

    expect(updated?.title).toBe("New title");
    expect(updated?.systemPrompt).toBe("Updated prompt");

    expect(repo.deleteConversation(conversation.id)).toBe(true);
    expect(repo.getConversation(conversation.id)).toBeNull();
  });

  it("clears messages and deletes last assistant message", () => {
    const conversation = repo.createConversation({}, "qwen2.5:7b");
    repo.addMessage(conversation.id, "user", "Question");
    repo.addMessage(conversation.id, "assistant", "Answer");

    const removed = repo.deleteLastAssistantMessage(conversation.id);
    expect(removed?.content).toBe("Answer");
    expect(repo.getMessages(conversation.id)).toHaveLength(1);

    expect(repo.clearMessages(conversation.id)).toBe(1);
    expect(repo.getMessages(conversation.id)).toHaveLength(0);
  });

  it("branches a conversation up to a selected message", () => {
    const conversation = repo.createConversation({ title: "Main" }, "qwen2.5:7b");
    repo.addMessage(conversation.id, "user", "Hello");
    repo.addMessage(conversation.id, "assistant", "Hi");
    const followUp = repo.addMessage(conversation.id, "user", "More");

    const branched = repo.branchConversation(
      conversation.id,
      followUp.id,
      "qwen2.5:7b",
    );

    expect(branched?.messages).toHaveLength(3);
    expect(branched?.title).toContain("branch");
  });

  it("deletes messages from a specific message onward", () => {
    const conversation = repo.createConversation({}, "qwen2.5:7b");
    repo.addMessage(conversation.id, "user", "One");
    const second = repo.addMessage(conversation.id, "assistant", "Two");
    repo.addMessage(conversation.id, "user", "Three");

    expect(repo.deleteMessagesFrom(conversation.id, second.id)).toBe(2);
    expect(repo.getMessages(conversation.id)).toHaveLength(1);
  });

  it("exports conversation to markdown", () => {
    const conversation = repo.createConversation(
      { title: "Export me", systemPrompt: "System rules" },
      "qwen2.5:7b",
    );
    repo.addMessage(conversation.id, "user", "Hello");
    repo.addMessage(conversation.id, "assistant", "World");

    const loaded = repo.getConversation(conversation.id)!;
    const markdown = conversationToMarkdown(loaded);

    expect(markdown).toContain("# Export me");
    expect(markdown).toContain("System rules");
    expect(markdown).toContain("## You");
    expect(markdown).toContain("Hello");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("World");
  });
});
