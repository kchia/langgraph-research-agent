import { AIMessage } from "@langchain/core/messages";
import type { ResearchState, ErrorContext } from "../graph/state.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { AgentNames } from "../graph/routes.js";
import { appendFindingsToMessage } from "../utils/findings-formatter.js";

/**
 * Error recovery agent that handles errors gracefully.
 *
 * Generates user-friendly error messages based on which node failed
 * and provides a graceful fallback response.
 */
export async function errorRecoveryAgent(
  state: ResearchState & { errorContext?: ErrorContext }
): Promise<Partial<ResearchState>> {
  const logger = createLoggerWithCorrelationId(
    "error-recovery-agent",
    state.correlationId
  );
  const error = state.errorContext;

  if (!error) {
    logger.warn("Error recovery called without error context");
    return {
      finalSummary:
        "An unexpected error occurred while processing your request. Please try again.",
      messages: [
        new AIMessage(
          "An unexpected error occurred while processing your request. Please try again."
        )
      ],
      currentAgent: AgentNames.ERROR_RECOVERY
    };
  }

  logger.error("Handling error in recovery node", {
    failedNode: error.failedNode,
    errorMessage: error.errorMessage,
    isRetryable: error.isRetryable
  });

  // Generate user-friendly error message based on failed node
  let userMessage: string;

  switch (error.failedNode) {
    case AgentNames.RESEARCH:
      userMessage =
        "I had trouble finding information about this company. " +
        "The data sources may be temporarily unavailable. " +
        "Please try again in a moment, or try rephrasing your query.";
      break;

    case AgentNames.CLARITY:
      userMessage =
        "I had trouble understanding your query. " +
        "Could you please rephrase it or provide more details?";
      break;

    case AgentNames.VALIDATOR:
      userMessage = appendFindingsToMessage(
        "I found some information but couldn't verify its quality. " +
          "Here's what I found, though it may be incomplete:",
        state.researchFindings,
        false // don't include key developments for validator errors
      );
      break;

    case AgentNames.SYNTHESIS:
      userMessage = appendFindingsToMessage(
        "I found information but had trouble generating a summary. " +
          "Here's what I found:",
        state.researchFindings,
        true // include key developments for synthesis errors
      );
      break;

    default:
      userMessage =
        "An error occurred while processing your request. " +
        "Please try again or rephrase your query.";
  }

  return {
    finalSummary: userMessage,
    messages: [new AIMessage(userMessage)],
    currentAgent: AgentNames.ERROR_RECOVERY,
    // Clear error context after handling
    errorContext: undefined
  };
}
