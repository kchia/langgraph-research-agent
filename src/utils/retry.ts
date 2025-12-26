import { Logger } from "./logger.js";

const logger = new Logger("retry");

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

/**
 * Execute a function with automatic retry and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param isRetryable - Function to determine if an error should trigger a retry
 * @param config - Optional retry configuration
 * @returns The result of the function if successful
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  let lastError: unknown;
  let delay = opts.baseDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt <= opts.maxRetries && isRetryable(error);

      logger.warn("Operation failed", {
        attempt,
        maxRetries: opts.maxRetries,
        willRetry: shouldRetry,
        nextDelayMs: shouldRetry ? delay : null,
        error: error instanceof Error ? error.message : String(error)
      });

      if (!shouldRetry) {
        throw error;
      }

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Common retry predicates for convenience.
 * Single source of truth for retryable error detection.
 */
export const retryPredicates = {
  /**
   * Retry on rate limit errors (HTTP 429).
   */
  isRateLimitError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return (
        error.message.includes("429") ||
        error.message.toLowerCase().includes("rate limit")
      );
    }
    return false;
  },

  /**
   * Retry on network errors.
   */
  isNetworkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return (
        error.message.includes("ECONNRESET") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ENOTFOUND") ||
        error.message.toLowerCase().includes("network")
      );
    }
    return false;
  },

  /**
   * Retry on timeout errors.
   */
  isTimeoutError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return error.message.toLowerCase().includes("timeout");
    }
    return false;
  },

  /**
   * Retry on server errors (502, 503).
   */
  isServerError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return (
        error.message.includes("502") ||
        error.message.includes("503")
      );
    }
    return false;
  },

  /**
   * Retry on any transient error (rate limit, network, timeout, or server error).
   */
  isTransientError: (error: unknown): boolean => {
    return (
      retryPredicates.isRateLimitError(error) ||
      retryPredicates.isNetworkError(error) ||
      retryPredicates.isTimeoutError(error) ||
      retryPredicates.isServerError(error)
    );
  }
};

/**
 * Determines if an error is retryable.
 * Unified function used by both retry logic and error handling.
 *
 * @param error - The error to check
 * @returns True if the error is likely retryable
 */
export function isRetryableError(error: unknown): boolean {
  return retryPredicates.isTransientError(error);
}
