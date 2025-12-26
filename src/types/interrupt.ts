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

/**
 * Type for interrupt data returned from graph state.
 * Matches the structure of ClarificationInterruptPayload.
 */
export interface InterruptData {
  type: string;
  question: string;
  originalQuery: string;
  attempt: number;
}

/**
 * Type guard to check if a value is valid interrupt data.
 *
 * @param value - The value to check
 * @returns True if value is valid interrupt data
 */
export function isInterruptData(value: unknown): value is InterruptData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.type === "string" &&
    typeof data.question === "string" &&
    typeof data.originalQuery === "string" &&
    typeof data.attempt === "number" &&
    data.attempt >= 0
  );
}

/**
 * Validate and extract interrupt data from graph state.
 * Returns null if the data is invalid or missing.
 *
 * @param value - The value from graph state interrupts
 * @returns Validated interrupt data or null if invalid
 */
export function validateInterruptData(value: unknown): InterruptData | null {
  if (!isInterruptData(value)) {
    return null;
  }

  return {
    type: value.type,
    question: value.question,
    originalQuery: value.originalQuery,
    attempt: value.attempt
  };
}
