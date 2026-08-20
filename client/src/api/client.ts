import type {
  BackupPreview,
  ChatStreamEvent,
  Conversation,
  ConversationWithMessages,
  CreateConversationRequest,
  CreatePromptRequest,
  DocumentChunk,
  DocumentRecord,
  DocumentScope,
  DocumentSearchResponse,
  DuplicateStrategy,
  ImportResult,
  MessageCitation,
  OllamaStatus,
  PromptTemplate,
  RagSearchResult,
  RenderPromptResponse,
  SearchResponse,
  UpdateConversationRequest,
  UsePromptResponse,
  UpdatePromptRequest,
} from "@localchat/shared";

export interface StreamMessageOptions {
  useDocuments?: boolean;
  documentScope?: DocumentScope;
  documentIds?: string[];
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (response.status === 0 || response.type === "error") {
      throw new Error(
        "Cannot reach LocalChat server. Restart with npm run dev and confirm http://127.0.0.1:3001/api/health responds.",
      );
    }
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchStatus(model?: string): Promise<OllamaStatus> {
  const query = model ? `?model=${encodeURIComponent(model)}` : "";
  const response = await fetch(`/api/status/status${query}`);
  return parseJson<OllamaStatus>(response);
}

export async function fetchModels(): Promise<{
  models: OllamaStatus["models"];
  defaultModel: string;
}> {
  const response = await fetch("/api/models");
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; models?: OllamaStatus["models"] }
      | null;
    throw new Error(body?.error ?? "Failed to load models");
  }
  return parseJson(response);
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch("/api/conversations");
  return parseJson(response);
}

export async function createConversation(
  input: CreateConversationRequest,
): Promise<Conversation> {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function getConversation(
  id: string,
): Promise<ConversationWithMessages> {
  const response = await fetch(`/api/conversations/${id}`);
  return parseJson(response);
}

export async function updateConversation(
  id: string,
  input: UpdateConversationRequest,
): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export async function clearConversationMessages(id: string): Promise<number> {
  const response = await fetch(`/api/conversations/${id}/messages`, {
    method: "DELETE",
  });
  const body = await parseJson<{ cleared: number }>(response);
  return body.cleared;
}

export async function truncateConversationFromMessage(
  conversationId: string,
  messageId: string,
): Promise<number> {
  const response = await fetch(
    `/api/conversations/${conversationId}/messages/from/${messageId}`,
    { method: "DELETE" },
  );
  const body = await parseJson<{ removed: number }>(response);
  return body.removed;
}

export async function branchConversation(
  conversationId: string,
  untilMessageId: string,
): Promise<ConversationWithMessages> {
  const response = await fetch(`/api/conversations/${conversationId}/branch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ untilMessageId }),
  });
  return parseJson(response);
}

export function downloadExport(id: string, format: "markdown" | "json"): void {
  const suffix = format === "markdown" ? "markdown" : "json";
  const anchor = document.createElement("a");
  anchor.href = `/api/conversations/${id}/export/${suffix}`;
  anchor.download = "";
  anchor.click();
}

export function downloadBackupZip(options?: {
  conversationIds?: string[];
  includeDocuments?: boolean;
  passphrase?: string;
}): void {
  const params = new URLSearchParams();
  if (options?.conversationIds?.length) {
    params.set("conversationIds", options.conversationIds.join(","));
  }
  if (options?.includeDocuments === false) {
    params.set("includeDocuments", "false");
  }
  if (options?.passphrase?.trim()) {
    params.set("passphrase", options.passphrase.trim());
  }
  const query = params.toString();
  const anchor = document.createElement("a");
  anchor.href = `/api/backup/zip${query ? `?${query}` : ""}`;
  anchor.download = "";
  anchor.click();
}

export async function previewBackup(
  file: File,
  passphrase?: string,
): Promise<BackupPreview> {
  const formData = new FormData();
  formData.append("archive", file);
  if (passphrase?.trim()) {
    formData.append("passphrase", passphrase.trim());
  }
  const response = await fetch("/api/backup/preview", {
    method: "POST",
    body: formData,
  });
  return parseJson(response);
}

export async function importBackup(
  file: File,
  duplicateStrategy: DuplicateStrategy,
  confirm: boolean,
  passphrase?: string,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("archive", file);
  formData.append("duplicateStrategy", duplicateStrategy);
  formData.append("confirm", confirm ? "true" : "false");
  if (passphrase?.trim()) {
    formData.append("passphrase", passphrase.trim());
  }
  const response = await fetch("/api/backup/import", {
    method: "POST",
    body: formData,
  });
  return parseJson(response);
}

export async function listPrompts(options?: {
  search?: string;
  category?: string;
  tag?: string;
  isPinned?: boolean;
  includeArchived?: boolean;
}): Promise<PromptTemplate[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set("search", options.search);
  if (options?.category) params.set("category", options.category);
  if (options?.tag) params.set("tag", options.tag);
  if (options?.isPinned) params.set("isPinned", "true");
  if (options?.includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  const response = await fetch(`/api/prompts${query ? `?${query}` : ""}`);
  return parseJson(response);
}

export async function getPrompt(id: string): Promise<PromptTemplate> {
  const response = await fetch(`/api/prompts/${id}`);
  return parseJson(response);
}

export async function listPromptCategories(): Promise<string[]> {
  const response = await fetch("/api/prompts/categories");
  const body = await parseJson<{ categories: string[] }>(response);
  return body.categories;
}

export async function listPromptTags(): Promise<string[]> {
  const response = await fetch("/api/prompts/tags");
  const body = await parseJson<{ tags: string[] }>(response);
  return body.tags;
}

export async function createPrompt(input: CreatePromptRequest): Promise<PromptTemplate> {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function updatePrompt(
  id: string,
  input: UpdatePromptRequest,
): Promise<PromptTemplate> {
  const response = await fetch(`/api/prompts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function duplicatePrompt(id: string): Promise<PromptTemplate> {
  const response = await fetch(`/api/prompts/${id}/duplicate`, { method: "POST" });
  return parseJson(response);
}

export async function deletePrompt(id: string): Promise<void> {
  const response = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete prompt");
  }
}

export async function usePromptTemplate(
  id: string,
  variables?: Record<string, string>,
): Promise<UsePromptResponse> {
  const response = await fetch(`/api/prompts/${id}/use`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variables }),
  });
  return parseJson(response);
}

export async function renderPrompt(
  id: string,
  variables: Record<string, string>,
): Promise<RenderPromptResponse> {
  const response = await fetch(`/api/prompts/${id}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variables }),
  });
  return parseJson(response);
}

export async function saveMessageAsPrompt(input: {
  messageId: string;
  conversationId: string;
  title?: string;
  category?: string;
  tags?: string[];
  asUserTemplate?: boolean;
}): Promise<PromptTemplate> {
  const response = await fetch("/api/prompts/from-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function searchLocal(params: {
  q: string;
  types?: string;
  role?: string;
  conversationId?: string;
  model?: string;
  hasCitations?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<SearchResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const response = await fetch(`/api/search?${query.toString()}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Search failed (${response.status})`);
  }
  return parseJson(response);
}

export async function rebuildSearch(): Promise<{
  conversations: number;
  messages: number;
  prompts: number;
  durationMs: number;
}> {
  const response = await fetch("/api/search/rebuild", { method: "POST" });
  return parseJson(response);
}

export async function reindexSearch(): Promise<{
  indexed: number;
  conversations: number;
  messages: number;
  prompts: number;
  durationMs: number;
}> {
  const response = await fetch("/api/search/reindex", { method: "POST" });
  return parseJson(response);
}

export async function listDocuments(search?: string): Promise<DocumentRecord[]> {
  const query = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  const response = await fetch(`/api/documents${query}`);
  return parseJson(response);
}

export async function uploadDocuments(
  files: File[],
): Promise<{ documents: DocumentRecord[]; errors: Array<{ filename: string; error: string }> }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      body?.error ??
        (response.status === 413
          ? "File too large (max 25 MB per file)"
          : `Upload failed (${response.status})`),
    );
  }

  return parseJson(response);
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete document");
  }
}

export async function reindexDocument(id: string): Promise<void> {
  const response = await fetch(`/api/documents/${id}/reindex`, {
    method: "POST",
  });
  await parseJson(response);
}

export async function listDocumentChunks(
  documentId: string,
): Promise<DocumentChunk[]> {
  const response = await fetch(`/api/documents/${documentId}/chunks`);
  return parseJson(response);
}

export async function searchDocuments(params: {
  q: string;
  documentIds?: string[];
  limit?: number;
}): Promise<DocumentSearchResponse> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.documentIds && params.documentIds.length > 0) {
    query.set("documentIds", params.documentIds.join(","));
  }
  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  const response = await fetch(`/api/documents/search?${query.toString()}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Document search failed (${response.status})`);
  }
  return parseJson(response);
}

export async function searchRag(
  query: string,
  documentIds?: string[],
): Promise<RagSearchResult> {
  const response = await fetch("/api/rag/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, documentIds }),
  });
  return parseJson(response);
}

async function consumeSseStream(
  response: Response,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error("Streaming request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      const payload = JSON.parse(line.slice(6)) as ChatStreamEvent;
      onEvent(payload);
    }
  }
}

export async function streamMessage(
  conversationId: string,
  content: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  options?: StreamMessageOptions,
): Promise<void> {
  const response = await fetch(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, ...options }),
    signal,
  });

  await consumeSseStream(response, onEvent);
}

export async function streamRegenerate(
  conversationId: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  model?: string,
  options?: StreamMessageOptions,
): Promise<void> {
  const response = await fetch(`/api/chat/${conversationId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, ...options }),
    signal,
  });

  await consumeSseStream(response, onEvent);
}

export function formatCitationLabel(citation: MessageCitation): string {
  const page =
    citation.pageNumber !== null ? `, page ${citation.pageNumber}` : "";
  return `[Source: ${citation.originalName}${page}, chunk ${citation.chunkIndex}]`;
}

export function highlightQueryTerms(text: string, query: string): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  if (terms.length === 0) {
    return text;
  }

  let highlighted = text;
  for (const term of terms) {
    const pattern = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    highlighted = highlighted.replace(pattern, "**$1**");
  }
  return highlighted;
}
