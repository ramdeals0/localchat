import type {
  CreatePromptRequest,
  PromptTemplate,
  UpdatePromptRequest,
} from "@localchat/shared";
import {
  assertVariablesMatchContent,
  parsePromptVariables,
  validatePromptTemplates,
} from "@localchat/shared";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./database.js";

interface PromptRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags_json: string;
  system_prompt: string | null;
  user_prompt_template: string;
  variables_json: string;
  default_model: string | null;
  default_temperature: number | null;
  rag_enabled: number;
  is_pinned: number;
  is_archived: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapPrompt(row: PromptRow): PromptTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: JSON.parse(row.tags_json) as string[],
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    variables: JSON.parse(row.variables_json) as string[],
    defaultModel: row.default_model,
    defaultTemperature: row.default_temperature,
    ragEnabled: row.rag_enabled === 1,
    isPinned: row.is_pinned === 1,
    isArchived: row.is_archived === 1,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
  };
}

function normalizeTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((tag) => tag.trim()).filter(Boolean);
}

function validatePromptInput(input: {
  systemPrompt?: string | null;
  userPromptTemplate: string;
  variables?: string[];
}): { systemPrompt: string | null; variables: string[] } {
  const systemPrompt = input.systemPrompt?.trim() ? input.systemPrompt.trim() : null;
  const userPromptTemplate = input.userPromptTemplate.trim();
  if (!userPromptTemplate) {
    throw new Error("User prompt template is required");
  }

  const errors = validatePromptTemplates(systemPrompt ?? "", userPromptTemplate);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const parsed = parsePromptVariables(systemPrompt ?? "", userPromptTemplate);
  const consistencyErrors = assertVariablesMatchContent(
    systemPrompt ?? "",
    userPromptTemplate,
    input.variables ?? parsed,
  );
  if (consistencyErrors.length > 0) {
    throw new Error(consistencyErrors.join("; "));
  }

  return { systemPrompt, variables: parsed };
}

export class PromptRepository {
  constructor(private readonly db: Database.Database = getDatabase()) {}

  listPrompts(options?: {
    search?: string;
    category?: string;
    tag?: string;
    isPinned?: boolean;
    includeArchived?: boolean;
  }): PromptTemplate[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (!options?.includeArchived) {
      conditions.push("is_archived = 0");
    }
    if (options?.isPinned) {
      conditions.push("is_pinned = 1");
    }
    if (options?.category) {
      conditions.push("category = @category");
      params.category = options.category;
    }
    if (options?.tag) {
      conditions.push("tags_json LIKE @tag");
      params.tag = `%${options.tag}%`;
    }
    if (options?.search?.trim()) {
      conditions.push(
        "(title LIKE @search OR description LIKE @search OR category LIKE @search OR tags_json LIKE @search OR user_prompt_template LIKE @search)",
      );
      params.search = `%${options.search.trim()}%`;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT * FROM prompt_templates ${where}
         ORDER BY is_pinned DESC,
                  CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END,
                  last_used_at DESC,
                  updated_at DESC,
                  title ASC`,
      )
      .all(params) as PromptRow[];

    return rows.map(mapPrompt);
  }

  listCategories(): string[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT category FROM prompt_templates
         WHERE is_archived = 0
         ORDER BY category ASC`,
      )
      .all() as Array<{ category: string }>;
    return rows.map((row) => row.category);
  }

  listTags(): string[] {
    const rows = this.db
      .prepare(`SELECT tags_json FROM prompt_templates WHERE is_archived = 0`)
      .all() as Array<{ tags_json: string }>;
    const tags = new Set<string>();
    for (const row of rows) {
      for (const tag of JSON.parse(row.tags_json) as string[]) {
        if (tag.trim()) tags.add(tag.trim());
      }
    }
    return Array.from(tags).sort();
  }

  getPrompt(id: string): PromptTemplate | null {
    const row = this.db
      .prepare("SELECT * FROM prompt_templates WHERE id = ?")
      .get(id) as PromptRow | undefined;
    return row ? mapPrompt(row) : null;
  }

  createPrompt(input: CreatePromptRequest, id: string = randomUUID()): PromptTemplate {
    const validated = validatePromptInput(input);
    const now = nowIso();
    const prompt: PromptTemplate = {
      id,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      category: input.category?.trim() || "Custom",
      tags: normalizeTags(input.tags),
      systemPrompt: validated.systemPrompt,
      userPromptTemplate: input.userPromptTemplate.trim(),
      variables: validated.variables,
      defaultModel: input.defaultModel ?? null,
      defaultTemperature: input.defaultTemperature ?? null,
      ragEnabled: input.ragEnabled ?? false,
      isPinned: input.isPinned ?? false,
      isArchived: false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
    };

    this.db
      .prepare(
        `INSERT INTO prompt_templates (
          id, title, description, category, tags_json, system_prompt, user_prompt_template,
          variables_json, default_model, default_temperature, rag_enabled, is_pinned,
          is_archived, usage_count, created_at, updated_at, last_used_at
        ) VALUES (
          @id, @title, @description, @category, @tagsJson, @systemPrompt, @userPromptTemplate,
          @variablesJson, @defaultModel, @defaultTemperature, @ragEnabled, @isPinned,
          @isArchived, @usageCount, @createdAt, @updatedAt, @lastUsedAt
        )`,
      )
      .run({
        id: prompt.id,
        title: prompt.title,
        description: prompt.description,
        category: prompt.category,
        tagsJson: JSON.stringify(prompt.tags),
        systemPrompt: prompt.systemPrompt,
        userPromptTemplate: prompt.userPromptTemplate,
        variablesJson: JSON.stringify(prompt.variables),
        defaultModel: prompt.defaultModel,
        defaultTemperature: prompt.defaultTemperature,
        ragEnabled: prompt.ragEnabled ? 1 : 0,
        isPinned: prompt.isPinned ? 1 : 0,
        isArchived: 0,
        usageCount: 0,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        lastUsedAt: null,
      });

    return prompt;
  }

  updatePrompt(id: string, input: UpdatePromptRequest): PromptTemplate | null {
    const existing = this.getPrompt(id);
    if (!existing) return null;

    const systemPrompt =
      input.systemPrompt !== undefined ? input.systemPrompt : existing.systemPrompt;
    const userPromptTemplate =
      input.userPromptTemplate !== undefined
        ? input.userPromptTemplate
        : existing.userPromptTemplate;

    const validated = validatePromptInput({
      systemPrompt,
      userPromptTemplate,
      variables: input.variables ?? existing.variables,
    });

    const updated: PromptTemplate = {
      ...existing,
      title: input.title?.trim() ?? existing.title,
      description:
        input.description !== undefined ? input.description?.trim() ?? null : existing.description,
      category: input.category?.trim() || existing.category,
      tags: input.tags ? normalizeTags(input.tags) : existing.tags,
      systemPrompt: validated.systemPrompt,
      userPromptTemplate: userPromptTemplate.trim(),
      variables: validated.variables,
      defaultModel:
        input.defaultModel !== undefined ? input.defaultModel : existing.defaultModel,
      defaultTemperature:
        input.defaultTemperature !== undefined
          ? input.defaultTemperature
          : existing.defaultTemperature,
      ragEnabled: input.ragEnabled ?? existing.ragEnabled,
      isPinned: input.isPinned ?? existing.isPinned,
      isArchived: input.isArchived ?? existing.isArchived,
      updatedAt: nowIso(),
    };

    this.db
      .prepare(
        `UPDATE prompt_templates SET
          title = @title, description = @description, category = @category,
          tags_json = @tagsJson, system_prompt = @systemPrompt,
          user_prompt_template = @userPromptTemplate, variables_json = @variablesJson,
          default_model = @defaultModel, default_temperature = @defaultTemperature,
          rag_enabled = @ragEnabled, is_pinned = @isPinned, is_archived = @isArchived,
          updated_at = @updatedAt
         WHERE id = @id`,
      )
      .run({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        tagsJson: JSON.stringify(updated.tags),
        systemPrompt: updated.systemPrompt,
        userPromptTemplate: updated.userPromptTemplate,
        variablesJson: JSON.stringify(updated.variables),
        defaultModel: updated.defaultModel,
        defaultTemperature: updated.defaultTemperature,
        ragEnabled: updated.ragEnabled ? 1 : 0,
        isPinned: updated.isPinned ? 1 : 0,
        isArchived: updated.isArchived ? 1 : 0,
        updatedAt: updated.updatedAt,
      });

    return updated;
  }

  duplicatePrompt(id: string): PromptTemplate | null {
    const existing = this.getPrompt(id);
    if (!existing) return null;

    return this.createPrompt({
      title: `${existing.title} (copy)`,
      description: existing.description,
      category: existing.category,
      tags: existing.tags,
      systemPrompt: existing.systemPrompt,
      userPromptTemplate: existing.userPromptTemplate,
      variables: existing.variables,
      defaultModel: existing.defaultModel,
      defaultTemperature: existing.defaultTemperature,
      ragEnabled: existing.ragEnabled,
      isPinned: false,
    });
  }

  recordUsage(id: string): void {
    const now = nowIso();
    this.db
      .prepare(
        `UPDATE prompt_templates
         SET usage_count = usage_count + 1, updated_at = @now, last_used_at = @now
         WHERE id = @id`,
      )
      .run({ id, now });
  }

  deletePrompt(id: string): boolean {
    const result = this.db.prepare("DELETE FROM prompt_templates WHERE id = ?").run(id);
    if (result.changes > 0) {
    }
    return result.changes > 0;
  }

  findByTitle(title: string): PromptTemplate | null {
    const row = this.db
      .prepare("SELECT * FROM prompt_templates WHERE title = ? LIMIT 1")
      .get(title.trim()) as PromptRow | undefined;
    return row ? mapPrompt(row) : null;
  }

  existsById(id: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM prompt_templates WHERE id = ?")
      .get(id) as { 1: number } | undefined;
    return Boolean(row);
  }
}
