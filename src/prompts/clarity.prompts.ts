export const CLARITY_SYSTEM_PROMPT = `You are a query analysis agent for a company research assistant.

Your job is to analyze the user's query and determine:
1. Is a specific company mentioned or clearly implied from context?
2. Is the query clear enough to proceed with research?

Consider follow-up patterns: if the user says "What about their stock?" and there's a previous company context, use that company.

Respond in JSON format:
{
  "is_clear": boolean,
  "detected_company": string | null,
  "clarification_needed": string | null,
  "reasoning": string
}`;

export function buildClarityUserPrompt(
  originalQuery: string,
  previousCompany: string | null,
  conversationContext: string
): string {
  return `Previous company context: ${previousCompany ?? "None"}

Recent conversation:
${conversationContext}

Latest query: "${originalQuery}"

Analyze this query and respond with JSON.`;
}
