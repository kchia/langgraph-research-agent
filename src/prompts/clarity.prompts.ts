import { escapeForPrompt } from "../utils/sanitization.js";

export const CLARITY_SYSTEM_PROMPT = `You are a query analysis agent for a company research assistant.

Your job is to analyze the user's query and determine:
1. Is a specific company mentioned or clearly implied from context?
2. Is the query clear enough to proceed with research?
3. Is the detected company name obviously fake, gibberish, or nonsensical?

IMPORTANT: If a company name appears to be random characters, gibberish, or obviously fake (e.g., "xyzabc", "asdf123", "qwerty", "abcdef"), mark is_clear as false and ask for clarification. Only proceed with real, recognizable company names. If you're uncertain whether a name is a real company, err on the side of asking for clarification rather than proceeding with research.

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
  conversationContext: string,
  clarificationResponse?: string | null
): string {
  const safeQuery = escapeForPrompt(originalQuery);
  const safeContext = conversationContext
    ? escapeForPrompt(conversationContext)
    : "No prior context";

  // Build clarification section if response exists
  const clarificationSection = clarificationResponse
    ? `\nUser clarification to previous question:\n${escapeForPrompt(clarificationResponse)}`
    : "";

  return `Previous company context: ${previousCompany ?? "None"}

Recent conversation:
${safeContext}
${clarificationSection}
Original query:
${safeQuery}

Analyze this query and respond with JSON.`;
}
