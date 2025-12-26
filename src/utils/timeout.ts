import { Logger } from "./logger.js";

const logger = new Logger("timeout");

/**
 * Default timeout for graph execution (5 minutes).
 * Can be overridden via GRAPH_TIMEOUT_MS environment variable.
 */
export const DEFAULT_GRAPH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get timeout configuration from environment or use default.
 */
export function getGraphTimeout(): number {
  const envTimeout = process.env.GRAPH_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    logger.warn("Invalid GRAPH_TIMEOUT_MS value, using default", {
      provided: envTimeout
    });
  }
  return DEFAULT_GRAPH_TIMEOUT_MS;
}

/**
 * Error thrown when graph execution times out.
 */
export class GraphTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, message?: string) {
    super(
      message ??
        `Graph execution timed out after ${timeoutMs}ms. The operation took too long to complete.`
    );
    this.name = "GraphTimeoutError";
  }
}

/**
 * Wrap a promise with a timeout.
 * If the promise doesn't resolve/reject within the timeout period,
 * the returned promise rejects with a GraphTimeoutError.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom timeout message
 * @returns Promise that rejects with GraphTimeoutError on timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      logger.error("Graph execution timeout", {
        timeoutMs,
        message: timeoutMessage
      });
      reject(new GraphTimeoutError(timeoutMs, timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Execute a graph operation with timeout protection.
 * This is a convenience wrapper that uses the configured timeout.
 *
 * @param operation - Async function to execute
 * @param timeoutMs - Optional timeout (uses configured default if not provided)
 * @param operationName - Name of operation for logging
 * @returns Promise that rejects with GraphTimeoutError on timeout
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs?: number,
  operationName = "graph operation"
): Promise<T> {
  const timeout = timeoutMs ?? getGraphTimeout();
  logger.debug("Executing operation with timeout", {
    operationName,
    timeoutMs: timeout
  });

  return withTimeout(operation(), timeout, `${operationName} timed out`);
}
