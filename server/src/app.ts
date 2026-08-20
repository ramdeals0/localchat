import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appConfig } from "./config.js";
import { DocumentRepository } from "./db/document-repository.js";
import { getDatabase } from "./db/database.js";
import { PromptRepository } from "./db/prompt-repository.js";
import { ChatRepository } from "./db/repository.js";
import { createBackupRouter } from "./routes/backup.js";
import { createChatRouter } from "./routes/chat.js";
import { createConversationsRouter } from "./routes/conversations.js";
import { createDocumentsRouter } from "./routes/documents.js";
import { healthRouter, modelsRouter } from "./routes/health.js";
import { createPromptsRouter } from "./routes/prompts.js";
import { ragRouter } from "./routes/rag.js";
import { createSearchRouter } from "./routes/search.js";
import { seedPromptTemplates, syncBuiltInPromptUpdates } from "./db/prompt-seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Application {
  getDatabase();
  const chatRepo = new ChatRepository();
  const documentRepo = new DocumentRepository();
  const promptRepo = new PromptRepository();

  try {
    seedPromptTemplates(promptRepo);
    syncBuiltInPromptUpdates(promptRepo);
  } catch (error) {
    console.warn("Prompt seed failed:", error);
  }

  const app = express();

  app.use(
    cors({
      origin: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "localchat" });
  });

  app.use("/api/status", healthRouter);
  app.use("/api/models", modelsRouter);
  app.use("/api/conversations", createConversationsRouter(chatRepo, documentRepo));
  app.use("/api/chat", createChatRouter(chatRepo, documentRepo));
  app.use("/api/documents", createDocumentsRouter(documentRepo));
  app.use("/api/rag", ragRouter);
  app.use("/api/prompts", createPromptsRouter(promptRepo, chatRepo));
  app.use("/api/search", createSearchRouter());
  app.use("/api/backup", createBackupRouter(chatRepo, promptRepo, documentRepo));

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res, next) => {
    if (_req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) {
        next();
      }
    });
  });

  return app;
}

export function startServer(): void {
  const app = createApp();
  app.listen(appConfig.port, appConfig.host, () => {
    console.log(
      `LocalChat server listening on http://${appConfig.host}:${appConfig.port}`,
    );
  });
}
