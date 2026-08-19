import type {
  Message,
  OllamaChatMessage,
  OllamaChatRequest,
} from "@localchat/shared";

/**
 * Maps stored chat messages plus an optional system prompt into Ollama's chat format.
 * System prompt is injected as the first message when non-empty.
 */
export function mapMessagesToOllama(
  systemPrompt: string,
  messages: Message[],
): OllamaChatMessage[] {
  const ollamaMessages: OllamaChatMessage[] = [];

  const trimmedSystem = systemPrompt.trim();
  if (trimmedSystem) {
    ollamaMessages.push({ role: "system", content: trimmedSystem });
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
): OllamaChatRequest {
  return {
    model,
    messages: mapMessagesToOllama(systemPrompt, messages),
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
