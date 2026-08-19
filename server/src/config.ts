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
  get ollamaBaseUrl() {
    return process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  },
  get defaultModel() {
    return process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
  },
};
