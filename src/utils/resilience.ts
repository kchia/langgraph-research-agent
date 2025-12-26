/**
 * Resilience patterns for external service calls.
 *
 * Provides circuit breaker functionality to prevent cascade failures
 * when external services are unavailable.
 */

import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
  type IPolicy
} from "cockatiel";
import { Logger } from "./logger.js";

const logger = new Logger("resilience");

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  consecutiveFailures: number;
  /** Time in ms before attempting half-open state */
  halfOpenAfterMs: number;
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  consecutiveFailures: 5,
  halfOpenAfterMs: 30000
};

/**
 * Create a circuit breaker policy for a named service.
 *
 * @param serviceName - Name of the service (for logging)
 * @param config - Optional circuit breaker configuration
 * @returns Circuit breaker policy
 */
export function createCircuitBreaker(
  serviceName: string,
  config: Partial<CircuitBreakerConfig> = {}
): IPolicy {
  const opts = { ...DEFAULT_CIRCUIT_CONFIG, ...config };

  const breaker = circuitBreaker(handleAll, {
    halfOpenAfter: opts.halfOpenAfterMs,
    breaker: new ConsecutiveBreaker(opts.consecutiveFailures)
  });

  breaker.onBreak(() => {
    logger.warn(`Circuit breaker opened for ${serviceName}`, {
      service: serviceName,
      reason: "consecutive failures exceeded threshold",
      halfOpenAfterMs: opts.halfOpenAfterMs
    });
  });

  breaker.onReset(() => {
    logger.info(`Circuit breaker reset for ${serviceName}`, {
      service: serviceName
    });
  });

  breaker.onHalfOpen(() => {
    logger.info(`Circuit breaker half-open for ${serviceName}`, {
      service: serviceName,
      message: "Testing if service is available"
    });
  });

  return breaker;
}

/**
 * Create a combined resilience policy with retry and circuit breaker.
 *
 * The policy applies retry first (inner), then circuit breaker (outer).
 * This means:
 * - Retries happen within a single circuit breaker "attempt"
 * - If all retries fail, that counts as one circuit breaker failure
 * - When circuit is open, requests fail fast without retrying
 *
 * @param serviceName - Name of the service (for logging)
 * @param retryConfig - Retry configuration
 * @param circuitConfig - Circuit breaker configuration
 * @returns Combined resilience policy
 */
export function createResiliencePolicy(
  serviceName: string,
  retryConfig: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {},
  circuitConfig: Partial<CircuitBreakerConfig> = {}
): IPolicy {
  const retryPolicy = retry(handleAll, {
    maxAttempts: (retryConfig.maxRetries ?? 2) + 1,
    backoff: new ExponentialBackoff({
      initialDelay: retryConfig.baseDelayMs ?? 1000,
      maxDelay: retryConfig.maxDelayMs ?? 30000
    })
  });

  const circuitBreakerPolicy = createCircuitBreaker(serviceName, circuitConfig);

  // Wrap: circuit breaker is outer, retry is inner
  return wrap(circuitBreakerPolicy, retryPolicy);
}

/**
 * Pre-configured circuit breaker for Tavily API.
 *
 * Opens after 5 consecutive failures, half-open after 30 seconds.
 */
export const tavilyCircuitBreaker = createCircuitBreaker("Tavily", {
  consecutiveFailures: 5,
  halfOpenAfterMs: 30000
});
