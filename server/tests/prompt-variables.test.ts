import { describe, expect, it } from "vitest";
import {
  findMalformedVariableTokens,
  interpolatePromptTemplate,
  parsePromptVariables,
  PromptVariableError,
  renderPromptPair,
  validatePromptTemplates,
  validateVariableValues,
} from "@localchat/shared";

describe("prompt variables", () => {
  it("parses valid variables from templates", () => {
    expect(parsePromptVariables("Hello {{topic}}", "For {{audience}}")).toEqual([
      "audience",
      "topic",
    ]);
  });

  it("rejects malformed variable tokens", () => {
    expect(findMalformedVariableTokens("Hello {{bad-name}}")).toEqual(["{{bad-name}}"]);
    expect(validatePromptTemplates("", "Bad {{1invalid}}")).toEqual([
      "Malformed variable token in user prompt: {{1invalid}}",
    ]);
  });

  it("detects required variables and missing values", () => {
    const required = parsePromptVariables("", "Summarize {{text}}");
    const result = validateVariableValues(required, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain("Missing value");
    }
  });

  it("interpolates supplied values", () => {
    expect(
      renderPromptPair({
        systemPrompt: "You are helpful.",
        userPromptTemplate: "Summarize {{text}}",
        values: { text: "LocalChat" },
      }).userPrompt,
    ).toBe("Summarize LocalChat");
  });

  it("throws when interpolation is incomplete", () => {
    expect(() =>
      interpolatePromptTemplate("Hello {{name}}", {}),
    ).toThrow(PromptVariableError);
  });
});
