/**
 * Retry utilities using p-retry for robust retry logic with exponential backoff.
 */

import pRetry, { AbortError, type RetryContext } from "p-retry";
import { createLoggerWithCorrelationId } from "./logger.js";

/**
 * Configuration options for retry operations.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Minimum timeout between retries in ms (default: 1000) */
  minTimeout?: number;
  /** Maximum timeout between retries in ms (default: 10000) */
  maxTimeout?: number;
  /** Correlation ID for logging */
  correlationId?: string | null;
  /** Operation name for logging */
  operation?: string;
}

const DEFAULT_OPTIONS = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 10000
} as const;

/**
 * Determines if an error is retryable by checking structured properties first,
 * then falling back to message matching.
 *
 * Priority:
 * 1. Check error.status (HTTP status code)
 * 2. Check error.code (Node.js error codes like ECONNRESET)
 * 3. Fall back to error.message string matching
 *
 * @param error - The error to check
 * @returns True if the error is likely retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check structured error properties first (more reliable)
  const anyError = error as unknown as Record<string, unknown>;

  // Check HTTP status codes
  if (typeof anyError.status === "number") {
    const status = anyError.status;
    // Retry on rate limits and server errors
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    // Don't retry on client errors (4xx except 429)
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Check Node.js error codes
  if (typeof anyError.code === "string") {
    const retryableCodes = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EPIPE",
      "ECONNREFUSED",
      "EAI_AGAIN"
    ];
    if (retryableCodes.includes(anyError.code)) {
      return true;
    }
  }

  // Fall back to message matching for errors without structured properties
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  );
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 *
 * - Retries transient errors (rate limits, timeouts, network issues)
 * - Aborts immediately on non-retryable errors
 * - Uses exponential backoff between retries
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(url),
 *   { retries: 3, operation: "fetch-data" }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLoggerWithCorrelationId(
    opts.operation ?? "retry",
    opts.correlationId ?? null
  );

  return pRetry(fn, {
    retries: opts.retries,
    minTimeout: opts.minTimeout,
    maxTimeout: opts.maxTimeout,
    onFailedAttempt: (context: RetryContext) => {
      // Abort immediately if error is not retryable
      if (!isRetryableError(context.error)) {
        logger.debug("Non-retryable error, aborting retry", {
          error: context.error.message,
          attemptNumber: context.attemptNumber
        });
        throw new AbortError(context.error.message);
      }

      logger.warn("Retry attempt failed", {
        attempt: context.attemptNumber,
        retriesLeft: context.retriesLeft,
        error: context.error.message,
        operation: opts.operation
      });
    }
  });
}

