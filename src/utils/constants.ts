// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum confidence score to skip validation and go directly to synthesis */
export const CONFIDENCE_THRESHOLD = 6;

/** Maximum research attempts before forced synthesis */
export const MAX_RESEARCH_ATTEMPTS = 3;

/** Maximum clarification attempts before forced proceed */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/** Message count threshold for triggering conversation summarization */
export const MESSAGE_SUMMARIZATION_THRESHOLD = 10;

/** Number of recent messages to keep when summarizing */
export const MESSAGES_TO_KEEP_AFTER_SUMMARY = 4;
