const VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;
const VALID_TOKEN_PATTERN = /\{\{([a-zA-Z][a-zA-Z0-9_]{0,49})\}\}/g;
const ANY_TOKEN_PATTERN = /\{\{([^}]+)\}\}/g;

export class PromptVariableError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "PromptVariableError";
  }
}

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME_PATTERN.test(name);
}

export function parsePromptVariables(
  systemPrompt: string,
  userPromptTemplate: string,
): string[] {
  const names = new Set<string>();
  for (const template of [systemPrompt, userPromptTemplate]) {
    for (const match of template.matchAll(VALID_TOKEN_PATTERN)) {
      names.add(match[1]!);
    }
  }
  return Array.from(names).sort();
}

export function findMalformedVariableTokens(template: string): string[] {
  const malformed: string[] = [];
  for (const match of template.matchAll(ANY_TOKEN_PATTERN)) {
    const inner = match[1]!.trim();
    if (!isValidVariableName(inner)) {
      malformed.push(match[0]!);
    }
  }
  return malformed;
}

export function validatePromptTemplates(
  systemPrompt: string,
  userPromptTemplate: string,
): string[] {
  const errors: string[] = [];
  for (const token of findMalformedVariableTokens(systemPrompt)) {
    errors.push(`Malformed variable token in system prompt: ${token}`);
  }
  for (const token of findMalformedVariableTokens(userPromptTemplate)) {
    errors.push(`Malformed variable token in user prompt: ${token}`);
  }

  const parsed = parsePromptVariables(systemPrompt, userPromptTemplate);
  return errors;
}

export function assertVariablesMatchContent(
  systemPrompt: string,
  userPromptTemplate: string,
  suppliedVariables: string[] | undefined,
): string[] {
  const errors = validatePromptTemplates(systemPrompt, userPromptTemplate);
  const parsed = parsePromptVariables(systemPrompt, userPromptTemplate);

  if (suppliedVariables !== undefined) {
    const suppliedSet = new Set(suppliedVariables);
    const parsedSet = new Set(parsed);

    for (const name of suppliedSet) {
      if (!parsedSet.has(name)) {
        errors.push(`Supplied variable "${name}" is not present in prompt content`);
      }
      if (!isValidVariableName(name)) {
        errors.push(`Supplied variable name is invalid: ${name}`);
      }
    }

    for (const name of parsedSet) {
      if (!suppliedSet.has(name)) {
        errors.push(`Missing supplied variable for content token: ${name}`);
      }
    }
  }

  return errors;
}

export function validateVariableValues(
  requiredVariables: string[],
  values: Record<string, string> | undefined,
): { ok: true; values: Record<string, string> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const normalized: Record<string, string> = {};

  for (const name of requiredVariables) {
    const raw = values?.[name];
    if (raw === undefined || raw.trim() === "") {
      errors.push(`Missing value for variable "${name}"`);
      continue;
    }
    normalized[name] = raw.trim();
  }

  if (values) {
    for (const [key, raw] of Object.entries(values)) {
      if (!requiredVariables.includes(key)) {
        errors.push(`Unknown variable supplied: ${key}`);
      } else if (raw !== undefined && raw.trim() === "" && !errors.includes(`Missing value for variable "${key}"`)) {
        errors.push(`Missing value for variable "${key}"`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, values: normalized };
}

export function interpolatePromptTemplate(
  template: string,
  values: Record<string, string>,
): string {
  const malformed = findMalformedVariableTokens(template);
  if (malformed.length > 0) {
    throw new PromptVariableError("Template contains malformed variable tokens", malformed);
  }

  const required = parsePromptVariables(template, "");
  const scopedValues: Record<string, string> = {};
  for (const name of required) {
    scopedValues[name] = values[name] ?? "";
  }
  const validation = validateVariableValues(required, scopedValues);
  if (!validation.ok) {
    throw new PromptVariableError("Cannot interpolate incomplete prompt", validation.errors);
  }

  return template.replace(VALID_TOKEN_PATTERN, (_full, name: string) => validation.values[name]!);
}

export function renderPromptPair(input: {
  systemPrompt: string;
  userPromptTemplate: string;
  values: Record<string, string>;
}): { systemPrompt: string; userPrompt: string; variables: string[] } {
  const templateErrors = validatePromptTemplates(
    input.systemPrompt,
    input.userPromptTemplate,
  );
  if (templateErrors.length > 0) {
    throw new PromptVariableError("Prompt template validation failed", templateErrors);
  }

  const variables = parsePromptVariables(input.systemPrompt, input.userPromptTemplate);
  const valueCheck = validateVariableValues(variables, input.values);
  if (!valueCheck.ok) {
    throw new PromptVariableError("Prompt variables are incomplete", valueCheck.errors);
  }

  return {
    systemPrompt: interpolatePromptTemplate(input.systemPrompt, valueCheck.values),
    userPrompt: interpolatePromptTemplate(input.userPromptTemplate, valueCheck.values),
    variables,
  };
}
