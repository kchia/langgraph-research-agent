/**
 * Type definitions for interrupt payloads and responses.
 *
 * These types ensure type-safe communication between the interrupt node
 * and the CLI/UI that handles user clarification.
 */

/**
 * Payload sent when graph interrupts for clarification.
 */
export interface ClarificationInterruptPayload {
  type: "clarification_needed";
  question: string;
  originalQuery: string;
  attempt: number;
}

/**
 * Valid response types for clarification interrupt.
 */
export type ClarificationResponse = string;

/**
 * Type guard for clarification responses.
 * Validates that the response is a non-empty string.
 *
 * @param value - The value to check
 * @returns True if value is a valid clarification response
 */
export function isClarificationResponse(
  value: unknown
): value is ClarificationResponse {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate and extract clarification response.
 * Throws if response is invalid.
 *
 * @param value - The value returned from interrupt()
 * @returns The validated and trimmed response string
 * @throws Error if response is not a valid non-empty string
 */
export function validateClarificationResponse(value: unknown): string {
  if (!isClarificationResponse(value)) {
    throw new Error(
      `Invalid clarification response: expected non-empty string, got ${typeof value}`
    );
  }
  return value.trim();
}
