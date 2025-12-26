import type { ResearchState } from "../graph/state.js";
import type { ErrorContext } from "../agents/error-recovery.agent.js";
import { Logger } from "./logger.js";

const logger = new Logger("error-handling");

/**
 * Wraps a node function with error handling.
 *
 * If the node throws an error, it catches it, logs it, and returns
 * a state update with errorContext set, allowing routing to error recovery.
 *
 * @param nodeName - Name of the node for error reporting
 * @param nodeFunction - The node function to wrap
 * @returns Wrapped node function that never throws
 */
export function withErrorHandling<T extends ResearchState>(
  nodeName: string,
  nodeFunction: (state: T) => Promise<Partial<ResearchState>>
): (state: T) => Promise<Partial<ResearchState>> {
  return async (state: T): Promise<Partial<ResearchState>> => {
    try {
      return await nodeFunction(state);
    } catch (error) {
      logger.error(`Error in node: ${nodeName}`, {
        error: error instanceof Error ? error.message : String(error),
        node: nodeName
      });

      const errorContext: ErrorContext = {
        failedNode: nodeName,
        errorMessage: error instanceof Error ? error.message : String(error),
        isRetryable: isRetryableError(error),
        originalError: error
      };

      // Return state with error context set
      // The graph can route to error recovery based on this
      return {
        errorContext,
        currentAgent: "error-recovery" as const
      };
    }
  };
}

/**
 * Determines if an error is retryable.
 *
 * @param error - The error to check
 * @returns True if the error is likely retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts, rate limits are usually retryable
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("503") ||
      message.includes("502")
    );
  }
  // Unknown errors are not retryable by default
  return false;
}
