/**
 * Input validation utilities for user queries.
 *
 * Validates user input before graph execution to prevent
 * invalid queries from causing downstream errors.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

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
 * Validate a user query input.
 *
 * @param query - The user's query string
 * @returns Validation result with valid flag and optional error message
 */
export function validateQuery(query: unknown): ValidationResult {
  // Check if query is a string
  if (typeof query !== "string") {
    return {
      valid: false,
      error: `Query must be a string, got ${typeof query}`
    };
  }

  const trimmed = query.trim();

  // Check if query is empty after trimming
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return {
      valid: false,
      error: "Query cannot be empty or only whitespace"
    };
  }

  // Check if query is too long
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Query is too long (${trimmed.length} characters). Maximum length is ${MAX_QUERY_LENGTH} characters.`
    };
  }

  // Check for potentially problematic characters (null bytes, etc.)
  if (trimmed.includes("\0")) {
    return {
      valid: false,
      error: "Query contains invalid characters (null bytes)"
    };
  }

  return { valid: true };
}

/**
 * Validate and normalize a user query.
 * Throws an error if validation fails.
 *
 * @param query - The user's query string
 * @returns Trimmed and validated query
 * @throws Error if query is invalid
 */
export function validateAndNormalizeQuery(query: unknown): string {
  const validation = validateQuery(query);

  if (!validation.valid) {
    throw new Error(
      `Invalid query: ${validation.error ?? "Unknown validation error"}`
    );
  }

  return (query as string).trim();
}
