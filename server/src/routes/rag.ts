import { Router } from "express";
import type { RagSearchRequest } from "@localchat/shared";
import { ragService } from "../rag/retriever.js";

export const ragRouter = Router();

ragRouter.post("/search", async (req, res) => {
  const body = req.body as RagSearchRequest;
  const query = body.query?.trim();

  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  try {
    const result = await ragService.search(query, body.documentIds);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : "RAG search failed",
      results: [],
      noRelevantSources: true,
    });
  }
});
