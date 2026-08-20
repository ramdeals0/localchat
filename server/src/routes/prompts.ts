import type {
  CreatePromptRequest,
  SaveMessageAsPromptRequest,
  UpdatePromptRequest,
  UsePromptRequest,
} from "@localchat/shared";
import { parsePromptVariables } from "@localchat/shared";
import { Router } from "express";
import type { ChatRepository } from "../db/repository.js";
import { PromptRepository } from "../db/prompt-repository.js";
import { PromptService } from "../services/prompt-service.js";
import { appConfig } from "../config.js";

export function createPromptsRouter(
  promptRepo: PromptRepository,
  chatRepo: ChatRepository,
): Router {
  const router = Router();
  const promptService = new PromptService(promptRepo, chatRepo);

  router.get("/", (req, res) => {
    const prompts = promptRepo.listPrompts({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
      isPinned: req.query.isPinned === "true" ? true : undefined,
      includeArchived: req.query.includeArchived === "true",
    });
    res.json(prompts);
  });

  router.get("/categories", (_req, res) => {
    res.json({ categories: promptRepo.listCategories() });
  });

  router.get("/tags", (_req, res) => {
    res.json({ tags: promptRepo.listTags() });
  });

  router.get("/:id", (req, res) => {
    const prompt = promptRepo.getPrompt(req.params.id);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.json(prompt);
  });

  router.post("/", (req, res) => {
    try {
      const input = req.body as CreatePromptRequest;
      if (!input.title?.trim()) {
        res.status(400).json({ error: "Title is required" });
        return;
      }
      if (!input.userPromptTemplate?.trim()) {
        res.status(400).json({ error: "User prompt template is required" });
        return;
      }
      const prompt = promptRepo.createPrompt(input);
      res.status(201).json(prompt);
    } catch (error) {
      const mapped = PromptService.mapVariableError(error);
      res.status(mapped.status).json(mapped);
    }
  });

  router.put("/:id", (req, res) => {
    try {
      const updated = promptRepo.updatePrompt(req.params.id, req.body as UpdatePromptRequest);
      if (!updated) {
        res.status(404).json({ error: "Prompt not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      const mapped = PromptService.mapVariableError(error);
      res.status(mapped.status).json(mapped);
    }
  });

  router.delete("/:id", (req, res) => {
    const deleted = promptRepo.deletePrompt(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.status(204).end();
  });

  router.post("/:id/duplicate", (req, res) => {
    const duplicated = promptRepo.duplicatePrompt(req.params.id);
    if (!duplicated) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.status(201).json(duplicated);
  });

  router.post("/:id/use", (req, res) => {
    try {
      const body = req.body as UsePromptRequest;
      const result = promptService.usePrompt(
        req.params.id,
        body.variables,
        appConfig.defaultModel,
      );
      res.status(201).json(result);
    } catch (error) {
      const mapped = PromptService.mapVariableError(error);
      res.status(mapped.status === 400 ? 400 : mapped.status).json(mapped);
    }
  });

  router.post("/:id/render", (req, res) => {
    try {
      const body = req.body as UsePromptRequest;
      const rendered = promptService.previewPrompt(req.params.id, body.variables ?? {});
      res.json(rendered);
    } catch (error) {
      const mapped = PromptService.mapVariableError(error);
      res.status(mapped.status).json(mapped);
    }
  });

  router.post("/from-message", (req, res) => {
    try {
      const input = req.body as SaveMessageAsPromptRequest;
      const conversation = chatRepo.getConversation(input.conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
      const message = conversation.messages.find((item) => item.id === input.messageId);
      if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const asUserTemplate = input.asUserTemplate ?? message.role === "user";
      const title =
        input.title?.trim() ||
        `${message.role === "user" ? "User" : "Assistant"} prompt — ${conversation.title}`.slice(
          0,
          120,
        );

      const systemPrompt = asUserTemplate ? conversation.systemPrompt : message.content;
      const userPromptTemplate = asUserTemplate ? message.content : "{{request}}";
      const variables = parsePromptVariables(systemPrompt ?? "", userPromptTemplate);

      const prompt = promptRepo.createPrompt({
        title,
        category: input.category ?? "Custom",
        tags: input.tags,
        systemPrompt: asUserTemplate ? conversation.systemPrompt : null,
        userPromptTemplate,
        variables,
        defaultModel: conversation.model,
      });
      res.status(201).json(prompt);
    } catch (error) {
      const mapped = PromptService.mapVariableError(error);
      res.status(mapped.status).json(mapped);
    }
  });

  return router;
}
