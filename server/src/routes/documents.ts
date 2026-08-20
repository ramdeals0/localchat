import { Router, type Express, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appConfig } from "../config.js";
import { DocumentRepository } from "../db/document-repository.js";
import { documentIndexer } from "../rag/indexer.js";
import {
  DocumentFtsUnavailableError,
  DocumentSearchRepository,
} from "../search/document-search-repository.js";
import { parseDocumentSearchParams } from "@localchat/shared";
import {
  buildStoredFilename,
  getFileExtension,
  isAllowedExtension,
  sanitizeOriginalFilename,
  validateMimeForExtension,
} from "../rag/file-validation.js";
import { resolveDocumentStoragePath } from "../rag/storage.js";

function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(path.resolve(appConfig.documentsPath), { recursive: true });
      cb(null, path.resolve(appConfig.documentsPath));
    },
    filename: (_req, file, cb) => {
      const id = randomUUID();
      const safeOriginal = sanitizeOriginalFilename(file.originalname);
      cb(null, buildStoredFilename(id, safeOriginal));
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: appConfig.maxUploadBytes,
      files: appConfig.maxUploadFiles,
    },
  });
}

function handleUploadErrors(
  error: unknown,
  res: Response,
): boolean {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `File too large. Maximum size is ${Math.round(appConfig.maxUploadBytes / (1024 * 1024))} MB.`,
      });
      return true;
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        error: `Too many files. Maximum is ${appConfig.maxUploadFiles} per upload.`,
      });
      return true;
    }
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return true;
  }
  return false;
}

export function createDocumentsRouter(
  documents = new DocumentRepository(),
): Router {
  const router = Router();
  const upload = createUploadMiddleware();
  const documentSearchRepo = new DocumentSearchRepository();

  router.get("/search", (req, res) => {
    const parsed = parseDocumentSearchParams({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      documentIds:
        typeof req.query.documentIds === "string" ? req.query.documentIds : undefined,
      limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
    });

    if (Array.isArray(parsed)) {
      res.status(400).json({
        error: parsed[0]?.message ?? "Invalid document search query",
        details: parsed,
      });
      return;
    }

    try {
      res.json(documentSearchRepo.search(parsed));
    } catch (error) {
      if (error instanceof DocumentFtsUnavailableError) {
        res.status(503).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: "Document search failed" });
    }
  });

  router.post("/", (req: Request, res: Response, next: NextFunction) => {
    upload.array("files", appConfig.maxUploadFiles)(req, res, (error) => {
      if (error) {
        if (!handleUploadErrors(error, res)) {
          next(error);
        }
        return;
      }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    if (files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    if (files.length > appConfig.maxUploadFiles) {
      res.status(400).json({
        error: `A maximum of ${appConfig.maxUploadFiles} files can be imported at once`,
      });
      return;
    }

    const created = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      const originalName = sanitizeOriginalFilename(file.originalname);

      if (!isAllowedExtension(originalName)) {
        errors.push({
          filename: originalName,
          error: "Unsupported file type",
        });
        fs.unlink(file.path, () => undefined);
        continue;
      }

      if (!validateMimeForExtension(originalName, file.mimetype)) {
        errors.push({
          filename: originalName,
          error: `MIME type does not match file extension (${file.mimetype || "unknown"})`,
        });
        fs.unlink(file.path, () => undefined);
        continue;
      }

      const storedName = path.basename(file.filename);
      const documentId = path.parse(storedName).name;

      try {
        const document = documents.createDocument({
          id: documentId,
          originalName,
          storedName,
          mimeType: file.mimetype || null,
          fileSize: file.size,
        });

        documentIndexer.queueIndex(document.id);
        created.push(document);
      } catch (storeError) {
        errors.push({
          filename: originalName,
          error:
            storeError instanceof Error ? storeError.message : "Failed to store document",
        });
        if (fs.existsSync(file.path)) {
          fs.unlink(file.path, () => undefined);
        }
      }
    }

    res.status(201).json({ documents: created, errors });
    });
  });

  router.get("/", (req, res) => {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    res.json(documents.listDocuments(search));
  });

  router.get("/:documentId", (req, res) => {
    const document = documents.getDocument(req.params.documentId);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(document);
  });

  router.get("/:documentId/chunks", (req, res) => {
    const document = documents.getDocument(req.params.documentId);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(documents.listChunks(document.id));
  });

  router.post("/:documentId/reindex", (req, res) => {
    const document = documents.getDocument(req.params.documentId);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    documents.updateDocumentStatus(document.id, "queued", {
      errorMessage: null,
    });
    documentIndexer.queueIndex(document.id);
    res.json({ ok: true, status: "queued" });
  });

  router.delete("/:documentId", (req, res) => {
    const document = documents.getDocument(req.params.documentId);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    documents.deleteDocument(document.id);
    try {
      const filePath = resolveDocumentStoragePath(document.storedName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore missing files on disk.
    }

    res.status(204).send();
  });

  return router;
}
