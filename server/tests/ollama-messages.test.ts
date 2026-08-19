import type { Message } from "@localchat/shared";
import { describe, expect, it } from "vitest";
import {
  buildOllamaChatRequest,
  mapMessagesToOllama,
  messagesForRegeneration,
} from "../src/ollama/messages.js";

const baseMessages: Message[] = [
  {
    id: "1",
    conversationId: "c1",
    role: "user",
    content: "Hello",
    createdAt: 1,
  },
  {
    id: "2",
    conversationId: "c1",
    role: "assistant",
    content: "Hi",
    createdAt: 2,
  },
  {
    id: "3",
    conversationId: "c1",
    role: "user",
    content: "How are you?",
    createdAt: 3,
  },
];

describe("Ollama message mapping", () => {
  it("injects system prompt as first message when provided", () => {
    const mapped = mapMessagesToOllama("You are helpful.", baseMessages);

    expect(mapped[0]).toEqual({
      role: "system",
      content: "You are helpful.",
    });
    expect(mapped[1]).toEqual({ role: "user", content: "Hello" });
    expect(mapped).toHaveLength(4);
  });

  it("skips empty system prompt", () => {
    const mapped = mapMessagesToOllama("   ", baseMessages);
    expect(mapped[0]?.role).toBe("user");
    expect(mapped).toHaveLength(3);
  });

  it("ignores stored system-role messages", () => {
    const withSystem: Message[] = [
      {
        id: "s1",
        conversationId: "c1",
        role: "system",
        content: "Legacy system row",
        createdAt: 0,
      },
      ...baseMessages,
    ];

    const mapped = mapMessagesToOllama("Active prompt", withSystem);
    expect(mapped.filter((m) => m.role === "system")).toHaveLength(1);
    expect(mapped[0]?.content).toBe("Active prompt");
  });

  it("builds streaming chat request", () => {
    const request = buildOllamaChatRequest(
      "qwen2.5:7b",
      "Be concise",
      baseMessages,
    );

    expect(request.model).toBe("qwen2.5:7b");
    expect(request.stream).toBe(true);
    expect(request.messages[0]?.role).toBe("system");
  });

  it("strips trailing assistant messages for regeneration", () => {
    const trimmed = messagesForRegeneration(baseMessages);
    expect(trimmed).toHaveLength(3);
    expect(trimmed[trimmed.length - 1]?.role).toBe("user");

    const onlyAssistant: Message[] = [
      {
        id: "a1",
        conversationId: "c1",
        role: "assistant",
        content: "orphan",
        createdAt: 1,
      },
    ];
    expect(messagesForRegeneration(onlyAssistant)).toHaveLength(0);
  });
});
