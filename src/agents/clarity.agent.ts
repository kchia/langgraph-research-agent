import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Clarity Agent
 * Always returns "clear" with mock company for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 8.
 */
export async function clarityAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    clarificationQuestion: null,
    currentAgent: "clarity"
  };
}
