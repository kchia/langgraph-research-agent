// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum confidence score to skip validation and go directly to synthesis */
export const CONFIDENCE_THRESHOLD = 6;

/** Confidence score threshold for "high" confidence level */
export const CONFIDENCE_HIGH_THRESHOLD = 8;

/** Confidence score threshold for "medium" confidence level */
export const CONFIDENCE_MEDIUM_THRESHOLD = 5;

/** Maximum research attempts before forced synthesis */
export const MAX_RESEARCH_ATTEMPTS = 3;

/** Maximum clarification attempts before forced proceed */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN BUDGETS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Token budget limits per agent.
 * These limits control how much content each agent can process.
 */
export const TOKEN_BUDGETS = {
  /** Validator agent: findings size for quality assessment */
  validator: {
    findings: 6000
  },
  /** Synthesis agent: can handle larger content for final response */
  synthesis: {
    findings: 8000
  },
  /** Clarity agent: max tokens for conversation context */
  clarity: {
    context: 4000
  }
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE SUMMARIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Threshold for when to summarize messages (in tokens).
 * Only summarize if conversation exceeds this threshold.
 */
export const SUMMARIZATION_THRESHOLD = 8000;

/**
 * Maximum tokens to use for recent messages after summarization.
 */
export const MAX_RECENT_MESSAGES_TOKENS = 2000;
