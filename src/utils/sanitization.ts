/**
 * Input sanitization utilities for prompt injection prevention.
 *
 * These utilities help protect against prompt injection attacks by:
 * 1. Removing control characters
 * 2. Filtering dangerous instruction patterns
 * 3. Limiting input length
 * 4. Escaping user input for safe embedding in prompts
 */

/**
 * Sanitize user input to prevent prompt injection attacks.
 *
 * @param input - The raw user input
 * @param maxLength - Maximum allowed length (default 2000)
 * @returns Sanitized input string
 */
export function sanitizeUserInput(
  input: string,
  maxLength: number = 2000
): string {
  if (!input) return "";

  let sanitized = input;

  // Remove null bytes and control characters (except newlines, tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Escape sequences that might be interpreted as instructions
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /human\s*:\s*/gi,
    /<\|.*?\|>/g, // Special tokens like <|endoftext|>
    /\[\[.*?\]\]/g // Bracket commands
  ];

  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "...[truncated]";
  }

  return sanitized.trim();
}

/**
 * Escape user input for safe embedding in prompts.
 * Wraps sanitized input in clear delimiters to separate from instructions.
 *
 * @param input - The raw user input
 * @returns Escaped and delimited input string
 */
export function escapeForPrompt(input: string): string {
  const sanitized = sanitizeUserInput(input);
  return `"""
${sanitized}
"""`;
}
