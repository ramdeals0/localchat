import type { MessageRole, SearchEntityType, SearchSnippetPart } from "./types.js";

const VALID_TYPES = new Set<SearchEntityType>(["conversation", "message", "prompt"]);
const VALID_ROLES = new Set<MessageRole>(["user", "assistant", "system"]);

export interface ParsedSearchParams {
  q: string;
  ftsQuery: string;
  types: SearchEntityType[];
  role?: MessageRole;
  conversationId?: string;
  model?: string;
  hasCitations?: boolean;
  fromMs?: number;
  toMs?: number;
  limit: number;
  offset: number;
}

export interface SearchValidationError {
  field: string;
  message: string;
}

export function normalizeFtsQuery(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      const cleaned = term.replace(/["*():^]/g, "").trim();
      if (!cleaned) {
        return null;
      }
      return `"${cleaned.replace(/"/g, '""')}"`;
    })
    .filter((term): term is string => Boolean(term))
    .join(" ");
}

export function parseSearchTypes(raw: string | undefined): SearchEntityType[] | SearchValidationError {
  if (!raw?.trim()) {
    return ["conversation", "message", "prompt"];
  }

  const types = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (types.length === 0) {
    return { field: "types", message: "types must include at least one value" };
  }

  for (const type of types) {
    if (!VALID_TYPES.has(type as SearchEntityType)) {
      return {
        field: "types",
        message: `Invalid search type "${type}". Use conversation, message, or prompt.`,
      };
    }
  }

  return types as SearchEntityType[];
}

export function parseIsoDateParam(
  raw: string | undefined,
  field: "from" | "to",
): number | undefined | SearchValidationError {
  if (raw === undefined || raw === "") {
    return undefined;
  }

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return { field, message: `${field} must be a valid ISO date string` };
  }
  return parsed;
}

export function parseSearchParams(input: {
  q?: string;
  types?: string;
  role?: string;
  conversationId?: string;
  model?: string;
  hasCitations?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
}): ParsedSearchParams | SearchValidationError[] {
  const errors: SearchValidationError[] = [];
  const q = typeof input.q === "string" ? input.q : "";

  if (!q.trim()) {
    errors.push({ field: "q", message: "Query parameter q is required" });
  }

  const ftsQuery = normalizeFtsQuery(q);
  if (q.trim() && !ftsQuery) {
    errors.push({ field: "q", message: "Search query contains no searchable terms" });
  }

  const typesResult = parseSearchTypes(input.types);
  if (!Array.isArray(typesResult)) {
    errors.push(typesResult);
  }

  let role: MessageRole | undefined;
  if (input.role !== undefined && input.role !== "") {
    if (!VALID_ROLES.has(input.role as MessageRole)) {
      errors.push({ field: "role", message: "role must be user, assistant, or system" });
    } else {
      role = input.role as MessageRole;
    }
  }

  let hasCitations: boolean | undefined;
  if (input.hasCitations !== undefined && input.hasCitations !== "") {
    if (input.hasCitations === "true") {
      hasCitations = true;
    } else if (input.hasCitations === "false") {
      hasCitations = false;
    } else {
      errors.push({ field: "hasCitations", message: "hasCitations must be true or false" });
    }
  }

  const fromResult = parseIsoDateParam(input.from, "from");
  if (typeof fromResult === "object" && fromResult !== null && "field" in fromResult) {
    errors.push(fromResult);
  }
  const toResult = parseIsoDateParam(input.to, "to");
  if (typeof toResult === "object" && toResult !== null && "field" in toResult) {
    errors.push(toResult);
  }

  let limit = 25;
  if (input.limit !== undefined && input.limit !== "") {
    const parsedLimit = Number(input.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push({ field: "limit", message: "limit must be an integer between 1 and 100" });
    } else {
      limit = parsedLimit;
    }
  }

  let offset = 0;
  if (input.offset !== undefined && input.offset !== "") {
    const parsedOffset = Number(input.offset);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      errors.push({ field: "offset", message: "offset must be a non-negative integer" });
    } else {
      offset = parsedOffset;
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  return {
    q: q.trim(),
    ftsQuery,
    types: typesResult as SearchEntityType[],
    role,
    conversationId:
      typeof input.conversationId === "string" && input.conversationId.trim()
        ? input.conversationId.trim()
        : undefined,
    model:
      typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined,
    hasCitations,
    fromMs: typeof fromResult === "number" ? fromResult : undefined,
    toMs: typeof toResult === "number" ? toResult : undefined,
    limit,
    offset,
  };
}

export function parseHighlightedSnippet(
  highlighted: string,
  fallback: string,
): { snippet: string; snippetParts: SearchSnippetPart[] } {
  if (!highlighted.includes("<mark>")) {
    return {
      snippet: fallback,
      snippetParts: [{ text: fallback, match: false }],
    };
  }

  const parts: SearchSnippetPart[] = [];
  let plain = "";
  const pattern = /<mark>(.*?)<\/mark>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(highlighted)) !== null) {
    if (match[1] !== undefined) {
      parts.push({ text: match[1], match: true });
      plain += match[1];
    } else if (match[2] !== undefined) {
      parts.push({ text: match[2], match: false });
      plain += match[2];
    }
  }

  return {
    snippet: plain.trim() || fallback,
    snippetParts: parts.length > 0 ? parts : [{ text: fallback, match: false }],
  };
}

export function buildFallbackSnippet(body: string, query: string, maxLen = 160): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1);
  const lower = body.toLowerCase();
  let bestIndex = 0;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1) {
      bestIndex = Math.max(0, index - 40);
      break;
    }
  }
  const slice = body.slice(bestIndex, bestIndex + maxLen);
  const prefix = bestIndex > 0 ? "…" : "";
  const suffix = bestIndex + maxLen < body.length ? "…" : "";
  return `${prefix}${slice.trim()}${suffix}`;
}

export interface ParsedDocumentSearchParams {
  q: string;
  ftsQuery: string;
  documentIds: string[];
  limit: number;
}

export function parseDocumentSearchParams(input: {
  q?: string;
  documentIds?: string;
  limit?: string;
}): ParsedDocumentSearchParams | SearchValidationError[] {
  const errors: SearchValidationError[] = [];
  const q = typeof input.q === "string" ? input.q : "";

  if (!q.trim()) {
    errors.push({ field: "q", message: "Query parameter q is required" });
  }

  const ftsQuery = normalizeFtsQuery(q);
  if (q.trim() && !ftsQuery) {
    errors.push({ field: "q", message: "Search query contains no searchable terms" });
  }

  const documentIds =
    typeof input.documentIds === "string" && input.documentIds.trim()
      ? input.documentIds
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

  let limit = 25;
  if (input.limit !== undefined && input.limit !== "") {
    const parsedLimit = Number(input.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push({ field: "limit", message: "limit must be an integer between 1 and 100" });
    } else {
      limit = parsedLimit;
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  return {
    q: q.trim(),
    ftsQuery,
    documentIds,
    limit,
  };
}
