import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

config({ path: path.join(rootDir, ".env") });

export const appConfig = {
  get port() {
    return parseInt(process.env.PORT ?? "3001", 10);
  },
  get host() {
    return process.env.HOST ?? "127.0.0.1";
  },
  get databasePath() {
    return (
      process.env.DATABASE_PATH ??
      path.join(rootDir, "data", "localchat.db")
    );
  },
  get documentsPath() {
    return (
      process.env.DOCUMENTS_PATH ??
      path.join(rootDir, "data", "documents")
    );
  },
  get ollamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  },
  get defaultModel() {
    return process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
  },
  get embeddingModel() {
    return process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
  },
  get ragEnabled() {
    return (process.env.RAG_ENABLED ?? "true").toLowerCase() === "true";
  },
  get ragTopK() {
    return parseInt(process.env.RAG_TOP_K ?? "5", 10);
  },
  get ragMinSimilarity() {
    return parseFloat(process.env.RAG_MIN_SIMILARITY ?? "0.35");
  },
  get ragChunkSize() {
    return parseInt(process.env.RAG_CHUNK_SIZE ?? "800", 10);
  },
  get ragChunkOverlap() {
    return parseInt(process.env.RAG_CHUNK_OVERLAP ?? "150", 10);
  },
  get exportsPath() {
    return (
      process.env.EXPORTS_PATH ??
      path.join(rootDir, "data", "exports")
    );
  },
  get logsPath() {
    return process.env.LOGS_PATH ?? path.join(rootDir, "data", "logs");
  },
  get maxUploadBytes() {
    return parseInt(process.env.MAX_UPLOAD_BYTES ?? String(25 * 1024 * 1024), 10);
  },
  get maxUploadFiles() {
    return parseInt(process.env.MAX_UPLOAD_FILES ?? "10", 10);
  },
};

export { rootDir };
