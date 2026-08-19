import { Router } from "express";
import { ollamaClient } from "../ollama/client.js";

export const healthRouter = Router();

healthRouter.get("/status", async (_req, res) => {
  const model = typeof _req.query.model === "string" ? _req.query.model : undefined;
  const status = await ollamaClient.getStatus(model);
  res.json(status);
});

export const modelsRouter = Router();

modelsRouter.get("/", async (_req, res) => {
  try {
    const status = await ollamaClient.getStatus();
    if (!status.online) {
      res.status(503).json({
        error: status.error ?? "Ollama is unavailable",
        models: [],
      });
      return;
    }
    res.json({ models: status.models, defaultModel: status.defaultModel });
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : "Failed to load models",
      models: [],
    });
  }
});
