import type { CreatePromptRequest } from "@localchat/shared";
import type { PromptRepository } from "./prompt-repository.js";

const ANALYZE_LOCAL_DOCUMENTS_SYSTEM = `You analyze the user's locally imported documents. Use only the retrieved excerpts in your answer.

Format every response as:
1. **Summary** — a concise 2–4 sentence answer to the question.
2. **Supporting snippets** — bullet points with short quoted excerpts from the sources. Each bullet must include the source label and a brief quote from the text.

If the documents do not contain enough information, say so clearly and do not invent details.`;

const LEGACY_ANALYZE_SYSTEM =
  "You analyze local documents accurately. Cite only what the provided context supports.";

const SEED_PROMPTS: Array<CreatePromptRequest & { id: string }> = [
  {
    id: "seed-explain-clearly",
    title: "Explain clearly",
    description: "Explain a topic in plain language with examples.",
    category: "General",
    tags: ["explain", "teaching"],
    systemPrompt: "You explain topics clearly, accurately, and without jargon unless necessary.",
    userPromptTemplate: "Explain {{topic}} clearly for {{audience}}.",
    defaultTemperature: 0.4,
  },
  {
    id: "seed-summarize-text",
    title: "Summarize text",
    description: "Summarize pasted or referenced text into key points.",
    category: "Writing",
    tags: ["summary"],
    systemPrompt: "You produce concise, faithful summaries.",
    userPromptTemplate: "Summarize the following in {{format}}:\n\n{{text}}",
    defaultTemperature: 0.3,
  },
  {
    id: "seed-code-review",
    title: "Code review",
    description: "Review code for bugs, readability, and maintainability.",
    category: "Development",
    tags: ["code", "review"],
    systemPrompt: "You review code carefully and prioritize correctness, clarity, and security.",
    userPromptTemplate:
      "Review this {{language}} code and list findings by severity:\n\n```{{language}}\n{{code}}\n```",
    defaultTemperature: 0.2,
  },
  {
    id: "seed-rewrite-professionally",
    title: "Rewrite professionally",
    description: "Rewrite text in a polished professional tone.",
    category: "Writing",
    tags: ["rewrite", "professional"],
    systemPrompt: "You rewrite text while preserving meaning and improving clarity.",
    userPromptTemplate: "Rewrite the following text in a professional tone:\n\n{{text}}",
    defaultTemperature: 0.5,
  },
  {
    id: "seed-analyze-local-documents",
    title: "Analyze local documents",
    description: "Summarize uploaded documents with quoted snippets from your library.",
    category: "Knowledge",
    tags: ["documents", "rag"],
    systemPrompt: ANALYZE_LOCAL_DOCUMENTS_SYSTEM,
    userPromptTemplate:
      "Analyze my local documents and provide a summary with supporting text snippets for: {{question}}",
    ragEnabled: true,
    defaultTemperature: 0.3,
  },
];

export function syncBuiltInPromptUpdates(promptRepo: PromptRepository): void {
  const analyze = promptRepo.getPrompt("seed-analyze-local-documents");
  if (!analyze) {
    return;
  }

  const legacyUserPrompt = "Analyze my local documents and answer: {{question}}";
  const shouldUpdate =
    analyze.systemPrompt === LEGACY_ANALYZE_SYSTEM ||
    analyze.userPromptTemplate === legacyUserPrompt;

  if (shouldUpdate) {
    promptRepo.updatePrompt(analyze.id, {
      description: "Summarize uploaded documents with quoted snippets from your library.",
      systemPrompt: ANALYZE_LOCAL_DOCUMENTS_SYSTEM,
      userPromptTemplate:
        "Analyze my local documents and provide a summary with supporting text snippets for: {{question}}",
    });
  }
}

export function seedPromptTemplates(promptRepo: PromptRepository): number {
  let inserted = 0;
  for (const seed of SEED_PROMPTS) {
    if (promptRepo.existsById(seed.id)) {
      continue;
    }
    promptRepo.createPrompt(seed, seed.id);
    inserted += 1;
  }
  return inserted;
}
