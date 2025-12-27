/**
 * Resilience patterns for external service calls.
 *
 * Provides circuit breaker functionality to prevent cascade failures
 * when external services are unavailable.
 */

import {
  circuitBreaker,
  ConsecutiveBreaker,
  handleAll,
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

