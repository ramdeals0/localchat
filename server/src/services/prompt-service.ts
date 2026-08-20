import type { UsePromptResponse } from "@localchat/shared";
import { PromptVariableError, renderPromptPair } from "@localchat/shared";
import { getDatabase } from "../db/database.js";
import type { ChatRepository } from "../db/repository.js";
import type { PromptRepository } from "../db/prompt-repository.js";

export class PromptService {
  constructor(
    private readonly promptRepo: PromptRepository,
    private readonly chatRepo: ChatRepository,
  ) {}

  usePrompt(
    promptId: string,
    variables: Record<string, string> | undefined,
    fallbackModel: string,
  ): UsePromptResponse {
    const prompt = this.promptRepo.getPrompt(promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }
    if (prompt.isArchived) {
      throw new Error("Archived prompts cannot be used");
    }

    const rendered = renderPromptPair({
      systemPrompt: prompt.systemPrompt ?? "",
      userPromptTemplate: prompt.userPromptTemplate,
      values: variables ?? {},
    });

    const conversation = getDatabase().transaction(() => {
      const created = this.chatRepo.createConversation(
        {
          title: prompt.title,
          systemPrompt: rendered.systemPrompt,
          model: prompt.defaultModel ?? fallbackModel,
        },
        fallbackModel,
      );
      this.chatRepo.addMessage(created.id, "user", rendered.userPrompt);
      this.promptRepo.recordUsage(promptId);
      const full = this.chatRepo.getConversation(created.id);
      if (!full) {
        throw new Error("Failed to create conversation from prompt");
      }
      return full;
    })();

    return {
      conversationId: conversation.id,
      conversation,
      ragEnabled: prompt.ragEnabled,
      defaultTemperature: prompt.defaultTemperature,
    };
  }

  previewPrompt(
    promptId: string,
    variables: Record<string, string>,
  ): ReturnType<typeof renderPromptPair> {
    const prompt = this.promptRepo.getPrompt(promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }
    return renderPromptPair({
      systemPrompt: prompt.systemPrompt ?? "",
      userPromptTemplate: prompt.userPromptTemplate,
      values: variables,
    });
  }

  static mapVariableError(error: unknown): { status: number; error: string; details?: string[] } {
    if (error instanceof PromptVariableError) {
      return {
        status: 400,
        error: error.message,
        details: error.details,
      };
    }
    if (error instanceof Error) {
      if (error.message === "Prompt not found") {
        return { status: 404, error: error.message };
      }
      if (error.message === "Archived prompts cannot be used") {
        return { status: 400, error: error.message };
      }
      return { status: 400, error: error.message };
    }
    return { status: 500, error: "Prompt operation failed" };
  }
}
