import type {
  DocumentScope,
  MessageCitation,
  RegenerateRequest,
  SendMessageRequest,
} from "@localchat/shared";
import { Router } from "express";
import { appConfig } from "../config.js";
import { DocumentRepository } from "../db/document-repository.js";
import { ChatRepository } from "../db/repository.js";
import { ollamaClient } from "../ollama/client.js";
import {
  buildOllamaChatRequest,
  messagesForRegeneration,
} from "../ollama/messages.js";
import { citationsToMessageCitations } from "../rag/context.js";
import { ragService } from "../rag/retriever.js";
import { endSse, initSse, sendSseEvent } from "../sse/helpers.js";

interface RagOptions {
  useDocuments?: boolean;
  documentScope?: DocumentScope;
  documentIds?: string[];
  userQuery?: string;
}

async function resolveRagContext(
  options: RagOptions,
): Promise<{
  ragContext: string;
  citations: Omit<MessageCitation, "id">[];
  noRelevantSources: boolean;
}> {
  if (!options.useDocuments || !appConfig.ragEnabled || !options.userQuery) {
    return { ragContext: "", citations: [], noRelevantSources: false };
  }

  const documentIds =
    options.documentScope === "selected" ? options.documentIds : undefined;

  const search = await ragService.search(options.userQuery, documentIds);
  if (search.noRelevantSources) {
    return { ragContext: "", citations: [], noRelevantSources: true };
  }

  return {
    ragContext: ragService.buildContext(search.results),
    citations: citationsToMessageCitations("pending", search.results),
    noRelevantSources: false,
  };
}

async function streamAssistantReply(
  chatRepo: ChatRepository,
  documentRepo: DocumentRepository,
  conversationId: string,
  model: string,
  signal: AbortSignal,
  onToken: (token: string) => void,
  ragOptions: RagOptions,
  onSources?: (payload: {
    citations: MessageCitation[];
    noRelevantSources: boolean;
  }) => void,
): Promise<{ messageId: string; content: string }> {
  const conversation = chatRepo.getConversation(conversationId, documentRepo);
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

  const rag = await resolveRagContext(ragOptions);
  if (onSources) {
    onSources({
      citations: rag.citations.map((citation, index) => ({
        ...citation,
        id: `temp-${index}`,
      })),
      noRelevantSources: rag.noRelevantSources,
    });
  }

  const request = buildOllamaChatRequest(
    model,
    conversation.systemPrompt,
    conversation.messages,
    rag.ragContext || undefined,
  );

  let content = "";
  for await (const token of ollamaClient.streamChat(request, signal)) {
    content += token;
    onToken(token);
  }

  const saved = chatRepo.addMessage(conversationId, "assistant", content);
  if (rag.citations.length > 0) {
    const persisted = documentRepo.saveCitations(
      saved.id,
      rag.citations.map((citation) => ({
        ...citation,
        messageId: saved.id,
      })),
    );
    saved.citations = persisted;
  }

  return { messageId: saved.id, content };
}

export function createChatRouter(
  chatRepo: ChatRepository,
  documentRepo = new DocumentRepository(),
): Router {
  const router = Router();

  router.post("/:id/messages", async (req, res) => {
    const conversationId = req.params.id;
    const body = req.body as SendMessageRequest;
    const content = body.content?.trim();

    if (!content) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const conversation = chatRepo.getConversation(conversationId, documentRepo);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    chatRepo.addMessage(conversationId, "user", content);

    initSse(res);
    const abortController = new AbortController();

    const abortStream = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };

    req.on("aborted", abortStream);
    res.on("close", abortStream);

    try {
      let sentSources = false;
      const result = await streamAssistantReply(
        chatRepo,
        documentRepo,
        conversationId,
        conversation.model,
        abortController.signal,
        (token) => sendSseEvent(res, { type: "token", content: token }),
        {
          useDocuments: body.useDocuments,
          documentScope: body.documentScope,
          documentIds: body.documentIds,
          userQuery: content,
        },
        ({ citations, noRelevantSources }) => {
          if (sentSources) {
            return;
          }
          sentSources = true;
          sendSseEvent(res, {
            type: "sources",
            citations,
            noRelevantSources,
          });
        },
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

    const conversation = chatRepo.getConversation(conversationId, documentRepo);
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

    chatRepo.deleteLastAssistantMessage(conversationId);
    const refreshed = chatRepo.getConversation(conversationId, documentRepo);
    if (!refreshed) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const model = body.model ?? refreshed.model;
    const contextMessages = messagesForRegeneration(refreshed.messages);

    initSse(res);
    const abortController = new AbortController();

    const abortStream = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };

    req.on("aborted", abortStream);
    res.on("close", abortStream);

    try {
      const status = await ollamaClient.getStatus(model);
      if (!status.online) {
        throw new Error(status.error ?? "Ollama is unavailable");
      }
      if (!status.selectedModelAvailable) {
        throw new Error(`Model "${model}" is not installed`);
      }

      const rag = await resolveRagContext({
        useDocuments: body.useDocuments,
        documentScope: body.documentScope,
        documentIds: body.documentIds,
        userQuery: lastUser.content,
      });

      sendSseEvent(res, {
        type: "sources",
        citations: rag.citations.map((citation, index) => ({
          ...citation,
          id: `temp-${index}`,
        })),
        noRelevantSources: rag.noRelevantSources,
      });

      const request = buildOllamaChatRequest(
        model,
        refreshed.systemPrompt,
        contextMessages,
        rag.ragContext || undefined,
      );

      let content = "";
      for await (const token of ollamaClient.streamChat(
        request,
        abortController.signal,
      )) {
        content += token;
        sendSseEvent(res, { type: "token", content: token });
      }

      const saved = chatRepo.addMessage(conversationId, "assistant", content);
      if (rag.citations.length > 0) {
        const persisted = documentRepo.saveCitations(
          saved.id,
          rag.citations.map((citation) => ({
            ...citation,
            messageId: saved.id,
          })),
        );
        saved.citations = persisted;
      }

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
