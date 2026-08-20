import type { DocumentChunkWithScore, MessageCitation } from "@localchat/shared";

export function formatCitationLabel(citation: {
  originalName: string;
  pageNumber: number | null;
  chunkIndex: number;
}): string {
  const page =
    citation.pageNumber !== null ? `, page ${citation.pageNumber}` : "";
  return `[Source: ${citation.originalName}${page}, chunk ${citation.chunkIndex}]`;
}

export function buildRagContextBlock(
  citations: DocumentChunkWithScore[],
): string {
  if (citations.length === 0) {
    return "";
  }

  const blocks = citations.map((chunk) => {
    const label = formatCitationLabel({
      originalName: chunk.originalName,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
    });
    return `${label}\n${chunk.content}`;
  });

  return [
    "The following excerpts come from the user's local document library.",
    "Use them only when relevant to the question.",
    "If they do not contain enough information, clearly say the library does not contain enough information.",
    "When you use a fact from an excerpt, cite it using the provided source label format.",
    "When summarizing documents, include a brief summary plus short quoted snippets from the excerpts.",
    "",
    ...blocks,
  ].join("\n");
}

export function citationsToMessageCitations(
  messageId: string,
  results: DocumentChunkWithScore[],
): Omit<MessageCitation, "id">[] {
  return results.map((result) => ({
    messageId,
    chunkId: result.id,
    documentId: result.documentId,
    originalName: result.originalName,
    pageNumber: result.pageNumber,
    chunkIndex: result.chunkIndex,
    content: result.content,
    similarity: result.similarity,
  }));
}

export function buildOllamaEmbedRequest(model: string, prompt: string) {
  return { model, prompt };
}
