export const SYNTHESIS_SYSTEM_PROMPT = `You are a research synthesis agent.

Generate a clear, helpful summary of the research findings for the user.
Be concise but comprehensive. Use natural language, not bullet points unless asked.

If data is limited, acknowledge this honestly. Never fabricate information.`;

export function buildSynthesisUserPrompt(
  originalQuery: string,
  company: string,
  findings: string,
  confidenceLevel: "high" | "medium" | "low"
): string {
  const confidenceNote = {
    high: "",
    medium: "Note: Some information may be incomplete.",
    low: "Note: Limited information available. Please verify independently."
  }[confidenceLevel];

  return `User's question: "${originalQuery}"

Company: ${company}

Research findings:
${findings}

${confidenceNote}

Generate a helpful summary for the user.`;
}
