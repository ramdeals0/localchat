export type MessageRole = "user" | "assistant" | "system";

export type DocumentStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export type DocumentIndexStage =
  | "extracting"
  | "chunking"
  | "embedding"
  | "saving"
  | "";

export interface Conversation {
  id: string;
  title: string;
  systemPrompt: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageCitation {
  id: string;
  messageId: string;
  chunkId: string;
  documentId: string;
  originalName: string;
  pageNumber: number | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  citations?: MessageCitation[];
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface DocumentRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string | null;
  fileSize: number;
  status: DocumentStatus;
  errorMessage: string | null;
  importedAt: string;
  indexedAt: string | null;
  chunkCount: number;
  indexStage: DocumentIndexStage;
  indexProgressCurrent: number;
  indexProgressTotal: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  charStart: number | null;
  charEnd: number | null;
  content: string;
  createdAt: string;
}

export interface DocumentChunkWithScore extends DocumentChunk {
  similarity: number;
  originalName: string;
}

export interface RagSearchResult {
  query: string;
  results: DocumentChunkWithScore[];
  noRelevantSources: boolean;
}

export interface DocumentSearchHit {
  chunkId: string;
  documentId: string;
  originalName: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  snippet: string;
  snippetParts: SearchSnippetPart[];
  rank: number;
}

export interface DocumentSearchResponse {
  query: string;
  total: number;
  hits: DocumentSearchHit[];
}

export interface OllamaModel {
  name: string;
  modifiedAt?: string;
  size?: number;
}

export interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at?: string;
    size?: number;
  }>;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
}

export interface OllamaEmbedRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbedResponse {
  embedding: number[];
}

export interface OllamaStatus {
  online: boolean;
  defaultModel: string;
  selectedModelAvailable: boolean;
  embeddingModelAvailable: boolean;
  embeddingModel: string;
  models: OllamaModel[];
  error?: string;
}

export interface CreateConversationRequest {
  title?: string;
  systemPrompt?: string;
  model?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  systemPrompt?: string;
  model?: string;
}

export type DocumentScope = "all" | "selected";

export interface SendMessageRequest {
  content: string;
  useDocuments?: boolean;
  documentScope?: DocumentScope;
  documentIds?: string[];
}

export interface RegenerateRequest {
  model?: string;
  useDocuments?: boolean;
  documentScope?: DocumentScope;
  documentIds?: string[];
}

export interface RagSearchRequest {
  query: string;
  documentIds?: string[];
  topK?: number;
  minSimilarity?: number;
}

export type ChatStreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; content: string }
  | { type: "error"; message: string }
  | {
      type: "sources";
      citations: MessageCitation[];
      noRelevantSources: boolean;
    };

// --- Prompt Library (Phase 3A) ---

export interface PromptTemplate {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  systemPrompt: string | null;
  userPromptTemplate: string;
  variables: string[];
  defaultModel: string | null;
  defaultTemperature: number | null;
  ragEnabled: boolean;
  isPinned: boolean;
  isArchived: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface CreatePromptRequest {
  title: string;
  description?: string | null;
  category?: string;
  tags?: string[];
  systemPrompt?: string | null;
  userPromptTemplate: string;
  variables?: string[];
  defaultModel?: string | null;
  defaultTemperature?: number | null;
  ragEnabled?: boolean;
  isPinned?: boolean;
}

export interface UpdatePromptRequest {
  title?: string;
  description?: string | null;
  category?: string;
  tags?: string[];
  systemPrompt?: string | null;
  userPromptTemplate?: string;
  variables?: string[];
  defaultModel?: string | null;
  defaultTemperature?: number | null;
  ragEnabled?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

export interface SaveMessageAsPromptRequest {
  messageId: string;
  conversationId: string;
  title?: string;
  category?: string;
  tags?: string[];
  asUserTemplate?: boolean;
}

export interface UsePromptRequest {
  variables?: Record<string, string>;
}

export interface UsePromptResponse {
  conversationId: string;
  conversation: ConversationWithMessages;
  ragEnabled: boolean;
  defaultTemperature: number | null;
}

export interface RenderPromptRequest {
  variables: Record<string, string>;
}

export interface RenderPromptResponse {
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
}

// --- Local Search ---

export type SearchEntityType = "conversation" | "message" | "prompt";

export interface SearchQuery {
  q: string;
  types?: SearchEntityType[];
  role?: MessageRole;
  conversationId?: string;
  model?: string;
  hasCitations?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface SearchSnippetPart {
  text: string;
  match: boolean;
}

export interface SearchHit {
  entityType: SearchEntityType;
  entityId: string;
  conversationId: string | null;
  conversationTitle: string | null;
  title: string;
  snippet: string;
  snippetParts: SearchSnippetPart[];
  role: MessageRole | null;
  model: string | null;
  hasCitation: boolean;
  createdAt: number;
  rank: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  hits: SearchHit[];
}

export interface SearchRebuildResponse {
  conversations: number;
  messages: number;
  prompts: number;
  durationMs: number;
}

// --- Export / Import ---

export const BACKUP_SCHEMA_VERSION = "localchat-backup-v1" as const;

export type DuplicateStrategy = "import-new" | "skip-duplicates" | "merge-prompts";

export interface BackupManifest {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  conversationCount: number;
  promptCount: number;
  documentCount: number;
  checksumAlgorithm: "sha256";
}

export interface BackupPreview {
  manifest: BackupManifest;
  conversations: Array<{ id: string; title: string; messageCount: number }>;
  prompts: Array<{ id: string; title: string; category: string }>;
  documents: Array<{ id: string; originalName: string; fileSize: number }>;
  encrypted: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportRequest {
  duplicateStrategy: DuplicateStrategy;
  confirm: boolean;
  passphrase?: string;
}

export interface ImportResult {
  importedConversations: number;
  skippedConversations: number;
  importedPrompts: number;
  mergedPrompts: number;
  importedDocuments: number;
  errors: string[];
}
