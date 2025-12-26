import type { ResearchState } from "./state.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../utils/constants.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("routers");

/**
 * Routes from Clarity Agent based on query clarity.
 *
 * @returns "interrupt" if clarification needed, "research" if clear
 */
export function clarityRouter(state: ResearchState): "interrupt" | "research" {
  const route =
    state.clarityStatus === "needs_clarification" ? "interrupt" : "research";

  logger.debug("Clarity router decision", {
    clarityStatus: state.clarityStatus,
    detectedCompany: state.detectedCompany,
    route
  });

  // Edge case: clear status but no company detected
  if (route === "research" && !state.detectedCompany) {
    logger.warn(
      "Proceeding to research without detected company - may result in poor results"
    );
  }

  return route;
}

/**
 * Routes from Research Agent based on confidence score.
 *
 * @returns "synthesis" if confidence >= threshold, "validator" otherwise
 */
export function researchRouter(
  state: ResearchState
): "validator" | "synthesis" {
  // Edge case: no findings at all should go to synthesis with apology
  if (!state.researchFindings) {
    logger.warn("No research findings - routing to synthesis for fallback");
    return "synthesis";
  }

  const route =
    state.confidenceScore >= CONFIDENCE_THRESHOLD ? "synthesis" : "validator";

  logger.debug("Research router decision", {
    confidenceScore: state.confidenceScore,
    threshold: CONFIDENCE_THRESHOLD,
    hasFindings: !!state.researchFindings,
    route
  });

  return route;
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

  let route: "research" | "synthesis";
  let reason: string;

  if (needsMoreResearch && canRetry) {
    route = "research";
    reason = "Validation insufficient, retrying research";
  } else if (needsMoreResearch && !canRetry) {
    route = "synthesis";
    reason = `Max research attempts (${MAX_RESEARCH_ATTEMPTS}) reached - proceeding with available data`;
    logger.warn(reason, {
      validationResult: state.validationResult,
      researchAttempts: state.researchAttempts
    });
  } else {
    route = "synthesis";
    reason = "Validation sufficient";
  }

  logger.debug("Validation router decision", {
    validationResult: state.validationResult,
    researchAttempts: state.researchAttempts,
    canRetry,
    route,
    reason
  });

  return route;
}
