import { AIMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Synthesis Agent
 * Returns static summary for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 11.
 */
export async function synthesisAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  const summary = `Here's what I found about ${
    state.detectedCompany ?? "the company"
  }: This is a stub response for testing.`;

  return {
    finalSummary: summary,
    messages: [new AIMessage(summary)],
    currentAgent: "synthesis"
  };
}
