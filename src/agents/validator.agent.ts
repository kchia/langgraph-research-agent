import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Validator Agent
 * Always returns "sufficient" for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 10.
 */
export async function validatorAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    validationResult: "sufficient",
    validationFeedback: null,
    currentAgent: "validator"
  };
}
