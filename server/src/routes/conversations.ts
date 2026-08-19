import type { CreateConversationRequest, UpdateConversationRequest } from "@localchat/shared";
import { Router } from "express";
import { appConfig } from "../config.js";
import { ChatRepository, conversationToMarkdown } from "../db/repository.js";

export function createConversationsRouter(repo: ChatRepository): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(repo.listConversations());
  });

  router.post("/", (req, res) => {
    const body = req.body as CreateConversationRequest;
    const conversation = repo.createConversation(body, appConfig.defaultModel);
    res.status(201).json(conversation);
  });

  router.get("/:id", (req, res) => {
    const conversation = repo.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conversation);
  });

  router.patch("/:id", (req, res) => {
    const body = req.body as UpdateConversationRequest;
    const conversation = repo.updateConversation(req.params.id, body);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conversation);
  });

  router.delete("/:id", (req, res) => {
    const deleted = repo.deleteConversation(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.status(204).send();
  });

  router.delete("/:id/messages", (req, res) => {
    const conversation = repo.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const count = repo.clearMessages(req.params.id);
    res.json({ cleared: count });
  });

  router.get("/:id/export/markdown", (req, res) => {
    const conversation = repo.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const markdown = conversationToMarkdown(conversation);
    const filename = `${conversation.title.replace(/[^\w\-]+/g, "_")}.md`;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(markdown);
  });

  router.get("/:id/export/json", (req, res) => {
    const conversation = repo.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const filename = `${conversation.title.replace(/[^\w\-]+/g, "_")}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(conversation, null, 2));
  });

  return router;
}
