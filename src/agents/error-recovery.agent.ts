import { AIMessage } from "@langchain/core/messages";
import type { ResearchState, ErrorContext } from "../graph/state.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { AgentNames } from "../graph/routes.js";

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
      userMessage =
        "I found some information but couldn't verify its quality. " +
        "Here's what I found, though it may be incomplete:";
      // Try to provide partial findings if available
      if (state.researchFindings) {
        const findings = state.researchFindings;
        userMessage += `\n\n**${findings.company}**:\n`;
        if (findings.recentNews) {
          userMessage += `Recent News: ${findings.recentNews}\n`;
        }
        if (findings.stockInfo) {
          userMessage += `Stock Info: ${findings.stockInfo}\n`;
        }
      }
      break;

    case AgentNames.SYNTHESIS:
      userMessage =
        "I found information but had trouble generating a summary. " +
        "Here's what I found:";
      // Try to provide raw findings if available
      if (state.researchFindings) {
        const findings = state.researchFindings;
        userMessage += `\n\n**${findings.company}**:\n`;
        if (findings.recentNews) {
          userMessage += `Recent News: ${findings.recentNews}\n`;
        }
        if (findings.stockInfo) {
          userMessage += `Stock Info: ${findings.stockInfo}\n`;
        }
        if (findings.keyDevelopments) {
          userMessage += `Key Developments: ${findings.keyDevelopments}\n`;
        }
      }
      break;

    default:
      userMessage =
        "An error occurred while processing your request. " +
        "Please try again or rephrase your query.";
  }

  return {
    finalSummary: userMessage,
    messages: [new AIMessage(userMessage)],
    currentAgent: "error-recovery",
    // Clear error context after handling
    errorContext: undefined
  };
}
