import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";
import { validateAndNormalizeQuery } from "./input-validation.js";
import { generateCorrelationId } from "./logger.js";

/**
 * Creates the input object for a new query.
 *
 * ## State Reset Behavior
 *
 * This function resets query-specific fields for a new query while preserving
 * conversation context. The state management follows these rules:
 *
 * ### Fields That Reset (Query-Specific)
 * These fields are reset to their initial values for each new query:
 * - `originalQuery`: New query text
 * - `clarityStatus`: Reset to "pending"
 * - `clarificationAttempts`: Reset to 0
 * - `clarificationQuestion`: Reset to null
 * - `clarificationResponse`: Reset to null
 * - `researchFindings`: Reset to null
 * - `confidenceScore`: Reset to 0
 * - `researchAttempts`: Reset to 0
 * - `validationResult`: Reset to "pending"
 * - `validationFeedback`: Reset to null
 * - `finalSummary`: Reset to null
 *
 * ### Fields That Persist (Conversation Context)
 * These fields are NOT reset and persist across queries:
 * - `messages`: Appended to via reducer (conversation history)
 * - `conversationSummary`: Preserved (summarized older messages)
 * - `detectedCompany`: Preserved (Clarity Agent decides when to update)
 * - `errorContext`: Preserved until cleared by error-recovery agent
 *
 * ### Special Case: detectedCompany
 * The `detectedCompany` field is intentionally NOT reset here. The Clarity Agent
 * analyzes the new query and decides whether to:
 * 1. Update it (if a new company is mentioned)
 * 2. Preserve it (if query is a follow-up like "What about their stock?")
 * 3. Clear it (if explicitly asked about a different company)
 *
 * This enables natural multi-turn conversations where users can ask follow-up
 * questions without repeating the company name.
 *
 * @param query - User's query string (will be validated and normalized)
 * @returns Partial state update for new query
 * @throws Error if query is invalid
 */
export function createNewQueryInput(query: string): Partial<ResearchState> {
  // Validate and normalize query
  const normalizedQuery = validateAndNormalizeQuery(query);
  return {
    // New message appends via reducer
    messages: [new HumanMessage(normalizedQuery)],

    // Query-specific fields that reset
    originalQuery: normalizedQuery,
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    clarificationResponse: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,

    // NOTE: detectedCompany is NOT reset here
    // Clarity Agent decides whether to update or preserve it

    // Observability: Generate correlation ID for new query
    // This persists across the query execution for request tracking
    correlationId: generateCorrelationId()
  };
}
