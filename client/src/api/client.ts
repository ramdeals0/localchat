import type {
  ChatStreamEvent,
  Conversation,
  ConversationWithMessages,
  CreateConversationRequest,
  OllamaStatus,
  UpdateConversationRequest,
} from "@localchat/shared";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
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

export function downloadExport(id: string, format: "markdown" | "json"): void {
  const suffix = format === "markdown" ? "markdown" : "json";
  const anchor = document.createElement("a");
  anchor.href = `/api/conversations/${id}/export/${suffix}`;
  anchor.download = "";
  anchor.click();
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
): Promise<void> {
  const response = await fetch(`/api/chat/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  await consumeSseStream(response, onEvent);
}

export async function streamRegenerate(
  conversationId: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
  model?: string,
): Promise<void> {
  const response = await fetch(`/api/chat/${conversationId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
    signal,
  });

  await consumeSseStream(response, onEvent);
}
