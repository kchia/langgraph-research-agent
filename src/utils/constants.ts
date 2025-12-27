// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum confidence score to skip validation and go directly to synthesis */
export const CONFIDENCE_THRESHOLD = 6;

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
  }
} as const;
