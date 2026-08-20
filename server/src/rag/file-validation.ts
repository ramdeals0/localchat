const ALLOWED_EXTENSIONS = new Set([
  "txt",
  "md",
  "pdf",
  "docx",
  "csv",
  "json",
]);

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  txt: ["text/plain", "application/octet-stream"],
  md: ["text/markdown", "text/plain", "text/x-markdown", "application/octet-stream"],
  pdf: ["application/pdf", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  csv: ["text/csv", "text/plain", "application/csv", "application/octet-stream"],
  json: ["application/json", "text/plain", "application/octet-stream"],
};

export function getFileExtension(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return null;
  }
  return base.slice(dot + 1).toLowerCase();
}

export function isAllowedExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ext !== null && ALLOWED_EXTENSIONS.has(ext);
}

export function validateMimeForExtension(
  filename: string,
  mimeType: string | undefined,
): boolean {
  const ext = getFileExtension(filename);
  if (!ext) {
    return false;
  }
  if (!mimeType) {
    return true;
  }
  const allowed = EXTENSION_MIME_MAP[ext];
  if (!allowed) {
    return false;
  }
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return allowed.includes(normalized);
}

export function sanitizeOriginalFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 200) || "document";
}

export function buildStoredFilename(id: string, originalName: string): string {
  const ext = getFileExtension(originalName);
  return ext ? `${id}.${ext}` : id;
}

export { ALLOWED_EXTENSIONS };
