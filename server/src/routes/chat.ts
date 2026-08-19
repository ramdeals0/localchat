import type { RegenerateRequest, SendMessageRequest } from "@localchat/shared";
import { Router } from "express";
import { ChatRepository } from "../db/repository.js";
import { ollamaClient } from "../ollama/client.js";
import {
  buildOllamaChatRequest,
  messagesForRegeneration,
} from "../ollama/messages.js";
import { endSse, initSse, sendSseEvent } from "../sse/helpers.js";

async function streamAssistantReply(
  repo: ChatRepository,
  conversationId: string,
  model: string,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<{ messageId: string; content: string }> {
  const conversation = repo.getConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const status = await ollamaClient.getStatus(model);
  if (!status.online) {
    throw new Error(status.error ?? "Ollama is unavailable. Start Ollama and try again.");
  }
  if (!status.selectedModelAvailable) {
    throw new Error(
      `Model "${model}" is not installed. Run: ollama pull ${model}`,
    );
  }

  const request = buildOllamaChatRequest(
    model,
    conversation.systemPrompt,
    conversation.messages,
  );

  let content = "";
  for await (const token of ollamaClient.streamChat(request, signal)) {
    content += token;
    onToken(token);
  }

  const saved = repo.addMessage(conversationId, "assistant", content);
  return { messageId: saved.id, content };
}

export function createChatRouter(repo: ChatRepository): Router {
  const router = Router();

  router.post("/:id/messages", async (req, res) => {
    const conversationId = req.params.id;
    const body = req.body as SendMessageRequest;
    const content = body.content?.trim();

    if (!content) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const conversation = repo.getConversation(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    repo.addMessage(conversationId, "user", content);

    initSse(res);
    const abortController = new AbortController();

    req.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const result = await streamAssistantReply(
        repo,
        conversationId,
        conversation.model,
        abortController.signal,
        (token) => sendSseEvent(res, { type: "token", content: token }),
      );

      sendSseEvent(res, {
        type: "done",
        messageId: result.messageId,
        content: result.content,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        sendSseEvent(res, { type: "error", message: "Generation stopped" });
      } else {
        sendSseEvent(res, {
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to generate reply",
        });
      }
    } finally {
      endSse(res);
    }
  });

  router.post("/:id/regenerate", async (req, res) => {
    const conversationId = req.params.id;
    const body = (req.body ?? {}) as RegenerateRequest;

    const conversation = repo.getConversation(conversationId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const lastUser = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "user");
    if (!lastUser) {
      res.status(400).json({ error: "No user message to regenerate from" });
      return;
    }

    repo.deleteLastAssistantMessage(conversationId);
    const refreshed = repo.getConversation(conversationId);
    if (!refreshed) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const model = body.model ?? refreshed.model;
    const contextMessages = messagesForRegeneration(refreshed.messages);

    initSse(res);
    const abortController = new AbortController();

    req.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const status = await ollamaClient.getStatus(model);
      if (!status.online) {
        throw new Error(status.error ?? "Ollama is unavailable");
      }
      if (!status.selectedModelAvailable) {
        throw new Error(`Model "${model}" is not installed`);
      }

      const request = buildOllamaChatRequest(
        model,
        refreshed.systemPrompt,
        contextMessages,
      );

      let content = "";
      for await (const token of ollamaClient.streamChat(
        request,
        abortController.signal,
      )) {
        content += token;
        sendSseEvent(res, { type: "token", content: token });
      }

      const saved = repo.addMessage(conversationId, "assistant", content);
      sendSseEvent(res, {
        type: "done",
        messageId: saved.id,
        content,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        sendSseEvent(res, { type: "error", message: "Generation stopped" });
      } else {
        sendSseEvent(res, {
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to regenerate",
        });
      }
    } finally {
      endSse(res);
    }
  });

  return router;
}
