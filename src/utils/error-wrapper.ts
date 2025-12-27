import type { ResearchState, ErrorContext, AgentName } from "../graph/state.js";
import { createLoggerWithCorrelationId } from "./logger.js";
import { isRetryableError } from "./retry.js";

/**
 * Type for agent functions that take state and return partial state updates.
 */
type AgentFunction = (state: ResearchState) => Promise<Partial<ResearchState>>;

/**
 * Wraps an agent function with automatic error handling.
 *
 * When an unhandled exception occurs in the wrapped agent:
 * 1. Logs the error with full context including stack trace
 * 2. Populates errorContext in state for the error-recovery node
 * 3. Returns a partial state update that will route to error-recovery
 *
 * This ensures that exceptions in agents don't crash the entire graph
 * and instead get routed to the error-recovery node for graceful handling.
 *
 * @param agentName - Name of the agent (for logging and errorContext)
 * @param agentFn - The agent function to wrap
 * @returns Wrapped agent function with error handling
 *
 * @example
 * ```typescript
 * // In workflow.ts
 * .addNode("clarity", withErrorHandling("clarity", clarityAgent))
 * ```
 */
export function withErrorHandling(
  agentName: AgentName,
  agentFn: AgentFunction
): AgentFunction {
  return async (state: ResearchState): Promise<Partial<ResearchState>> => {
    const logger = createLoggerWithCorrelationId(
      `error-wrapper:${agentName}`,
      state.correlationId
    );

    try {
      return await agentFn(state);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const isRetryable = isRetryableError(error);

      logger.error("Agent failed with unhandled error", {
        agentName,
        errorMessage,
        isRetryable,
        stack,
        errorType: error instanceof Error ? error.name : typeof error
      });

      const errorContext: ErrorContext = {
        failedNode: agentName,
        errorMessage,
        isRetryable,
        originalError: error
      };

      // Return state update that will trigger error-recovery routing
      return {
        errorContext,
        currentAgent: agentName
      };
    }
  };
}
