import { escapeForPrompt } from "../utils/sanitization.js";

export const VALIDATOR_SYSTEM_PROMPT = `You are a research quality validator.

Assess whether the research findings adequately answer the user's question.

Evaluate:
1. Relevance: Does this data address what was asked?
2. Completeness: Are there obvious gaps?
3. Quality: Is the information specific and useful?

Respond in JSON format:
{
  "is_sufficient": boolean,
  "feedback": string | null,
  "reasoning": string
}`;

export function buildValidatorUserPrompt(
  originalQuery: string,
  findings: string,
  confidenceScore: number
): string {
  const safeQuery = escapeForPrompt(originalQuery);
  const safeFindings = escapeForPrompt(findings);

  return `Original query:
${safeQuery}

Research findings:
${safeFindings}

Confidence score: ${confidenceScore}/10

Evaluate the quality and respond with JSON.`;
}
