import type { DuplicateStrategy, ImportRequest } from "@localchat/shared";
import { Router } from "express";
import multer from "multer";
import type { ChatRepository } from "../db/repository.js";
import type { DocumentRepository } from "../db/document-repository.js";
import type { PromptRepository } from "../db/prompt-repository.js";
import { BackupService } from "../export/backup-service.js";
import { appConfig } from "../config.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: appConfig.maxUploadBytes, files: 1 },
});

export function createBackupRouter(
  chatRepo: ChatRepository,
  promptRepo: PromptRepository,
  documentRepo: DocumentRepository,
): Router {
  const router = Router();
  const backupService = new BackupService(chatRepo, promptRepo, documentRepo);

  router.get("/zip", async (req, res) => {
    try {
      const conversationIds =
        typeof req.query.conversationIds === "string"
          ? req.query.conversationIds.split(",").filter(Boolean)
          : undefined;
      const includeDocuments = req.query.includeDocuments !== "false";
      const passphrase =
        typeof req.query.passphrase === "string" ? req.query.passphrase : undefined;

      const archive = await backupService.createZipBackup({
        conversationIds,
        includeDocuments,
        passphrase,
      });

      const encrypted = Boolean(passphrase?.trim());
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="localchat-backup-${Date.now()}${encrypted ? ".enc" : ""}.zip"`,
      );
      res.send(archive);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Export failed",
      });
    }
  });

  router.post("/preview", upload.single("archive"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Archive file is required" });
        return;
      }
      const passphrase =
        typeof req.body.passphrase === "string" ? req.body.passphrase : undefined;
      const preview = await backupService.previewBackup(req.file.buffer, passphrase);
      res.json(preview);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Preview failed",
      });
    }
  });

  router.post("/import", upload.single("archive"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Archive file is required" });
        return;
      }

      const body = req.body as ImportRequest & { duplicateStrategy?: DuplicateStrategy };
      const duplicateStrategy = body.duplicateStrategy ?? "import-new";
      const confirm = body.confirm === true || req.body.confirm === "true";
      const passphrase =
        typeof body.passphrase === "string" ? body.passphrase : undefined;

      const result = await backupService.importBackup(
        req.file.buffer,
        duplicateStrategy,
        confirm,
        passphrase,
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Import failed",
      });
    }
  });

  return router;
}
