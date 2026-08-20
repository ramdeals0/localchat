import path from "node:path";
import { appConfig } from "../config.js";

export function resolveDocumentStoragePath(storedName: string): string {
  const base = path.resolve(appConfig.documentsPath);
  const resolved = path.resolve(base, storedName);
  const relative = path.relative(base, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid document storage path");
  }

  return resolved;
}
