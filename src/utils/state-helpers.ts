import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * Creates the input object for a new query.
 *
 * Resets query-specific fields while allowing persistent fields
 * (messages, detectedCompany) to be managed by reducers/agents.
 */
export function createNewQueryInput(query: string): Partial<ResearchState> {
  return {
    // New message appends via reducer
    messages: [new HumanMessage(query)],

    // Query-specific fields that reset
    originalQuery: query,
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null

    // NOTE: detectedCompany is NOT reset here
    // Clarity Agent decides whether to update or preserve it
  };
}
