export type MessageRole = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  title: string;
  systemPrompt: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
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

export interface OllamaStatus {
  online: boolean;
  defaultModel: string;
  selectedModelAvailable: boolean;
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

export interface SendMessageRequest {
  content: string;
}

export interface RegenerateRequest {
  model?: string;
}

export type ChatStreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; messageId: string; content: string }
  | { type: "error"; message: string };
