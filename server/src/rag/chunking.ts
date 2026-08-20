import type { ExtractedSegment } from "./extractors.js";

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number | null;
  charStart: number;
  charEnd: number;
  content: string;
}

export function chunkExtractedText(
  segments: ExtractedSegment[],
  chunkSize: number,
  overlap: number,
): TextChunk[] {
  const normalizedOverlap = Math.min(Math.max(overlap, 0), chunkSize - 1);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let globalOffset = 0;

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) {
      continue;
    }

    const segmentStart = globalOffset;
    let cursor = 0;

    while (cursor < text.length) {
      const end = Math.min(cursor + chunkSize, text.length);
      const content = text.slice(cursor, end).trim();
      if (content) {
        chunks.push({
          chunkIndex,
          pageNumber: segment.pageNumber,
          charStart: segmentStart + cursor,
          charEnd: segmentStart + end,
          content,
        });
        chunkIndex += 1;
      }

      if (end >= text.length) {
        break;
      }
      cursor = Math.max(end - normalizedOverlap, cursor + 1);
    }

    globalOffset += text.length + 2;
  }

  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function highlightTerms(text: string, query: string): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2);

  if (terms.length === 0) {
    return text;
  }

  let highlighted = text;
  for (const term of terms) {
    const pattern = new RegExp(`(${escapeRegExp(term)})`, "gi");
    highlighted = highlighted.replace(pattern, "**$1**");
  }
  return highlighted;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
