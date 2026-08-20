import type { Message, OllamaChatMessage, OllamaChatRequest } from "@localchat/shared";

export function mapMessagesToOllama(
  systemPrompt: string,
  messages: Message[],
  ragContext?: string,
): OllamaChatMessage[] {
  const ollamaMessages: OllamaChatMessage[] = [];
  const parts: string[] = [];

  const trimmedSystem = systemPrompt.trim();
  if (trimmedSystem) {
    parts.push(trimmedSystem);
  }

  if (ragContext?.trim()) {
    parts.push(ragContext.trim());
  }

  if (parts.length > 0) {
    ollamaMessages.push({ role: "system", content: parts.join("\n\n") });
  }

  for (const message of messages) {
    if (message.role === "system") {
      continue;
    }
    ollamaMessages.push({
      role: message.role,
      content: message.content,
    });
  }

  return ollamaMessages;
}

export function buildOllamaChatRequest(
  model: string,
  systemPrompt: string,
  messages: Message[],
  ragContext?: string,
): OllamaChatRequest {
  return {
    model,
    messages: mapMessagesToOllama(systemPrompt, messages, ragContext),
    stream: true,
  };
}

export function messagesForRegeneration(messages: Message[]): Message[] {
  const result = [...messages];

  while (result.length > 0 && result[result.length - 1]?.role === "assistant") {
    result.pop();
  }

  return result;
}
