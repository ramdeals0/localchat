import { parseSearchParams } from "@localchat/shared";
import { Router } from "express";
import { SearchRepository, FtsUnavailableError } from "../search/search-repository.js";
import { SearchIndexService } from "../search/search-index.js";

export function createSearchRouter(): Router {
  const router = Router();
  const searchRepo = new SearchRepository();
  const searchIndex = new SearchIndexService();

  router.get("/", (req, res) => {
    const parsed = parseSearchParams({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      types: typeof req.query.types === "string" ? req.query.types : undefined,
      role: typeof req.query.role === "string" ? req.query.role : undefined,
      conversationId:
        typeof req.query.conversationId === "string" ? req.query.conversationId : undefined,
      model: typeof req.query.model === "string" ? req.query.model : undefined,
      hasCitations:
        typeof req.query.hasCitations === "string" ? req.query.hasCitations : undefined,
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
      offset: typeof req.query.offset === "string" ? req.query.offset : undefined,
    });

    if (Array.isArray(parsed)) {
      res.status(400).json({
        error: parsed[0]?.message ?? "Invalid search query",
        details: parsed,
      });
      return;
    }

    try {
      res.json(searchRepo.search(parsed));
    } catch (error) {
      if (error instanceof FtsUnavailableError) {
        res.status(503).json({
          error: "Full-text search is unavailable on this device. Rebuild indexes after enabling FTS5.",
        });
        return;
      }
      res.status(400).json({ error: "Search failed" });
    }
  });

  router.post("/rebuild", (_req, res) => {
    try {
      const result = searchIndex.rebuildAll();
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("FTS5")) {
        res.status(503).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to rebuild search indexes" });
    }
  });

  router.post("/reindex", (_req, res) => {
    try {
      const result = searchIndex.rebuildAll();
      res.json({
        indexed: result.conversations + result.messages + result.prompts,
        ...result,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("FTS5")) {
        res.status(503).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: "Failed to rebuild search indexes" });
    }
  });

  return router;
}
