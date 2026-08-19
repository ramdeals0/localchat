import type { OllamaChatRequest, OllamaModel, OllamaStatus, OllamaTagsResponse } from "@localchat/shared";
import { appConfig } from "../config.js";

export class OllamaClient {
  constructor(
    private readonly baseUrl: string = appConfig.ollamaBaseUrl,
    private readonly defaultModel: string = appConfig.defaultModel,
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async fetchTags(): Promise<OllamaModel[]> {
    const response = await fetch(this.url("/api/tags"), {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Ollama tags request failed (${response.status})`);
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? []).map((model) => ({
      name: model.name,
      modifiedAt: model.modified_at,
      size: model.size,
    }));
  }

  async getStatus(selectedModel?: string): Promise<OllamaStatus> {
    const modelToCheck = selectedModel ?? this.defaultModel;

    try {
      const models = await this.fetchTags();
      const modelNames = models.map((m) => m.name);
      const selectedModelAvailable = modelNames.some(
        (name) => name === modelToCheck || name.startsWith(`${modelToCheck}:`),
      );

      return {
        online: true,
        defaultModel: this.defaultModel,
        selectedModelAvailable,
        models,
      };
    } catch (error) {
      return {
        online: false,
        defaultModel: this.defaultModel,
        selectedModelAvailable: false,
        models: [],
        error: error instanceof Error ? error.message : "Ollama unavailable",
      };
    }
  }

  async *streamChat(
    request: OllamaChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await fetch(this.url("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        body || `Ollama chat request failed (${response.status})`,
      );
    }

    if (!response.body) {
      throw new Error("Ollama returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          const payload = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };

          if (payload.message?.content) {
            yield payload.message.content;
          }
        }
      }

      if (buffer.trim()) {
        const payload = JSON.parse(buffer.trim()) as {
          message?: { content?: string };
        };
        if (payload.message?.content) {
          yield payload.message.content;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const ollamaClient = new OllamaClient();
