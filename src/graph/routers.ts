import type { ResearchState } from "./state.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../utils/constants.js";

/**
 * Routes from Clarity Agent based on query clarity.
 *
 * @returns "interrupt" if clarification needed, "research" if clear
 */
export function clarityRouter(state: ResearchState): "interrupt" | "research" {
  if (state.clarityStatus === "needs_clarification") {
    return "interrupt";
  }
  return "research";
}

/**
 * Routes from Research Agent based on confidence score.
 *
 * @returns "synthesis" if confidence >= threshold, "validator" otherwise
 */
export function researchRouter(
  state: ResearchState
): "validator" | "synthesis" {
  if (state.confidenceScore >= CONFIDENCE_THRESHOLD) {
    return "synthesis";
  }
  return "validator";
}

/**
 * Routes from Validator Agent based on validation result and attempt count.
 *
 * Implements loop protection: max 3 research attempts.
 *
 * @returns "research" for retry, "synthesis" to proceed
 */
export function validationRouter(
  state: ResearchState
): "research" | "synthesis" {
  const canRetry = state.researchAttempts < MAX_RESEARCH_ATTEMPTS;
  const needsMoreResearch = state.validationResult === "insufficient";

  if (needsMoreResearch && canRetry) {
    return "research";
  }

  return "synthesis";
}
