/**
 * Input validation utilities for user queries.
 *
 * Uses Zod for schema validation, consistent with agent structured output patterns.
 * Validates user input before graph execution to prevent invalid queries
 * from causing downstream errors.
 */

import { z } from "zod";

/**
 * Maximum allowed query length (characters).
 * Prevents extremely long queries that could cause issues.
 */
const MAX_QUERY_LENGTH = 5000;

/**
 * Minimum query length after trimming.
 * Empty or whitespace-only queries should be handled separately.
 */
const MIN_QUERY_LENGTH = 1;

/**
 * Zod schema for query validation.
 * Validates type, length, and content constraints.
 */
export const QuerySchema = z
  .string({
    required_error: "Query is required",
    invalid_type_error: "Query must be a string"
  })
  .transform((s) => s.trim())
  .refine((s) => s.length >= MIN_QUERY_LENGTH, {
    message: "Query cannot be empty or only whitespace"
  })
  .refine((s) => s.length <= MAX_QUERY_LENGTH, {
    message: `Query is too long. Maximum length is ${MAX_QUERY_LENGTH} characters.`
  })
  .refine((s) => !s.includes("\0"), {
    message: "Query contains invalid characters (null bytes)"
  });

/**
 * Type for validated query (inferred from schema).
 */
export type ValidatedQuery = z.infer<typeof QuerySchema>;

/**
 * Validate and normalize a user query.
 * Throws an error if validation fails.
 *
 * @param query - The user's query string
 * @returns Trimmed and validated query
 * @throws Error if query is invalid
 */
export function validateAndNormalizeQuery(query: unknown): string {
  const result = QuerySchema.safeParse(query);

  if (result.success) {
    return result.data;
  }

  const error = result.error.errors[0]?.message ?? "Unknown validation error";
  throw new Error(`Invalid query: ${error}`);
}
