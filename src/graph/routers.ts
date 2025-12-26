import { z } from "zod";
import type { ResearchState } from "./state.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../utils/constants.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("routers");

/**
 * Zod schema for validating confidence score.
 */
const ConfidenceScoreSchema = z.number().finite().min(0).max(10);

/**
 * Zod schema for validating research attempts.
 */
const ResearchAttemptsSchema = z.number().int().nonnegative();

/**
 * Validate confidence score using Zod.
 * Returns the validated score or null if invalid.
 */
function validateConfidenceScore(score: unknown): number | null {
  const result = ConfidenceScoreSchema.safeParse(score);
  if (!result.success) {
    return null;
  }
  return result.data;
}

/**
 * Validate research attempts using Zod.
 * Returns the validated attempts or null if invalid.
 */
function validateResearchAttempts(attempts: unknown): number | null {
  const result = ResearchAttemptsSchema.safeParse(attempts);
  if (!result.success) {
    return null;
  }
  return result.data;
}

/**
 * Checks if state has an error and routes to error recovery.
 * Should be called first in any router to catch errors.
 *
 * @param state - Current state
 * @returns "error-recovery" if error present, null otherwise
 */
export function checkForError(state: ResearchState): "error-recovery" | null {
  if (state.errorContext) {
    logger.warn("Error detected in state, routing to error recovery", {
      failedNode: state.errorContext.failedNode,
      errorMessage: state.errorContext.errorMessage
    });
    return "error-recovery";
  }
  return null;
}

/**
 * Routes from Clarity Agent based on query clarity.
 *
 * @returns "interrupt" if clarification needed, "research" if clear
 */
export function clarityRouter(
  state: ResearchState
): "interrupt" | "research" | "error-recovery" {
  // Check for errors first
  const errorRoute = checkForError(state);
  if (errorRoute) return errorRoute;

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
): "validator" | "synthesis" | "error-recovery" {
  // Check for errors first
  const errorRoute = checkForError(state);
  if (errorRoute) return errorRoute;

  // Edge case: no findings at all should go to synthesis for fallback
  if (!state.researchFindings) {
    logger.warn("No research findings - routing to synthesis for fallback");
    return "synthesis";
  }

  // Validate confidence score using Zod
  const validatedConfidence = validateConfidenceScore(state.confidenceScore);
  if (validatedConfidence === null) {
    logger.warn(
      "Invalid confidence score, defaulting to validator for validation",
      { confidenceScore: state.confidenceScore }
    );
    return "validator";
  }

  const route =
    validatedConfidence >= CONFIDENCE_THRESHOLD ? "synthesis" : "validator";

  logger.debug("Research router decision", {
    confidenceScore: validatedConfidence,
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
): "research" | "synthesis" | "error-recovery" {
  // Check for errors first
  const errorRoute = checkForError(state);
  if (errorRoute) return errorRoute;

  // Validate validationResult is not pending
  if (state.validationResult === "pending") {
    logger.warn(
      "Validation router called with pending result, defaulting to synthesis",
      {
        validationResult: state.validationResult,
        researchAttempts: state.researchAttempts
      }
    );
    return "synthesis";
  }

  // Validate researchAttempts using Zod
  const validatedAttempts = validateResearchAttempts(state.researchAttempts);
  if (validatedAttempts === null) {
    logger.warn("Invalid researchAttempts, defaulting to synthesis", {
      researchAttempts: state.researchAttempts
    });
    return "synthesis";
  }

  const canRetry = validatedAttempts < MAX_RESEARCH_ATTEMPTS;
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
    researchAttempts: validatedAttempts,
    canRetry,
    route,
    reason
  });

  return route;
}
