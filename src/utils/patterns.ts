/**
 * Patterns that indicate a follow-up query (uses previous context)
 */
export const FOLLOW_UP_PATTERNS = [
  /^(what about|tell me more|how about|and|also|furthermore)/i,
  /^(their|its|the company's|they|them)\b/i,
  /^(compare|versus|vs\.?|compared to)/i,
  /^(explain|elaborate|expand on|go deeper)/i,
  /^(why|how|when did|is that|are they)\b/i
];

/**
 * Patterns that indicate user wants to cancel/exit
 */
export const CANCEL_PATTERNS = [
  /^(nevermind|never mind|cancel|stop|quit|exit|forget it|nvm)$/i
];

/**
 * Check if query is a follow-up to previous context
 */
export function isFollowUpQuery(
  query: string,
  hasExistingCompany: boolean
): boolean {
  if (!hasExistingCompany) return false;
  const trimmed = query.trim();
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if user wants to cancel the current operation
 */
export function isCancelRequest(query: string): boolean {
  return CANCEL_PATTERNS.some((pattern) => pattern.test(query.trim()));
}
