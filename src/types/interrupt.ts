import { z } from "zod";

/**
 * Type definitions for interrupt payloads and responses.
 *
 * These types ensure type-safe communication between the interrupt node
 * and the CLI/UI that handles user clarification.
 */

/**
 * Zod schema for clarification interrupt payload.
 */
export const ClarificationInterruptPayloadSchema = z.object({
  type: z.literal("clarification_needed"),
  question: z.string(),
  originalQuery: z.string(),
  attempt: z.number().int().nonnegative()
});

/**
 * Payload sent when graph interrupts for clarification.
 */
export type ClarificationInterruptPayload = z.infer<
  typeof ClarificationInterruptPayloadSchema
>;

/**
 * Zod schema for clarification responses.
 * Validates that the response is a non-empty string.
 */
export const ClarificationResponseSchema = z
  .string()
  .trim()
  .min(1, "Clarification response cannot be empty");

/**
 * Valid response types for clarification interrupt.
 */
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;

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
  return ClarificationResponseSchema.safeParse(value).success;
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
  const result = ClarificationResponseSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid clarification response: ${result.error.errors
        .map((e) => e.message)
        .join(", ")}`
    );
  }
  return result.data;
}

/**
 * Zod schema for interrupt data returned from graph state.
 * Matches the structure of ClarificationInterruptPayload but allows any string type.
 */
export const InterruptDataSchema = z.object({
  type: z.string(),
  question: z.string(),
  originalQuery: z.string(),
  attempt: z.number().int().nonnegative()
});

/**
 * Type for interrupt data returned from graph state.
 * Matches the structure of ClarificationInterruptPayload.
 */
export type InterruptData = z.infer<typeof InterruptDataSchema>;

/**
 * Type guard to check if a value is valid interrupt data.
 *
 * @param value - The value to check
 * @returns True if value is valid interrupt data
 */
export function isInterruptData(value: unknown): value is InterruptData {
  return InterruptDataSchema.safeParse(value).success;
}

/**
 * Result type for interrupt validation with error details.
 */
export interface InterruptValidationResult {
  success: boolean;
  data?: InterruptData;
  errors?: string[];
}

/**
 * Validate interrupt data and return detailed result.
 *
 * @param value - The value from graph state interrupts
 * @returns Validation result with data or error details
 */
export function validateInterruptDataWithErrors(
  value: unknown
): InterruptValidationResult {
  const result = InterruptDataSchema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      )
    };
  }
  return {
    success: true,
    data: result.data
  };
}

/**
 * Validate and extract interrupt data from graph state.
 * Returns null if the data is invalid or missing.
 *
 * @param value - The value from graph state interrupts
 * @returns Validated interrupt data or null if invalid
 */
export function validateInterruptData(value: unknown): InterruptData | null {
  const result = validateInterruptDataWithErrors(value);
  return result.success ? result.data! : null;
}
