import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clarity analysis result from the Clarity Agent
 */
export type ClarityStatus = "pending" | "clear" | "needs_clarification";

/**
 * Validation result from the Validator Agent
 */
export type ValidationResult = "pending" | "sufficient" | "insufficient";

/**
 * Agent identifiers for observability and routing
 */
export type AgentName =
  | "clarity"
  | "research"
  | "validator"
  | "synthesis"
  | "interrupt";

/**
 * Structured research findings from data sources
 */
export interface ResearchFindings {
  /** Normalized company name */
  company: string;

  /** Recent news summary */
  recentNews: string | null;

  /** Stock/financial information */
  stockInfo: string | null;

  /** Key business developments */
  keyDevelopments: string | null;

  /** Data source citations */
  sources: string[];

  /** Raw data for debugging */
  rawData: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE ANNOTATION
// ═══════════════════════════════════════════════════════════════════════════

export const ResearchStateAnnotation = Annotation.Root({
  // ─── Conversation ───
  /**
   * Full conversation history for multi-turn support.
   * Uses append reducer to accumulate messages across turns.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  // ─── Query Analysis ───
  /**
   * The user's original query text, extracted from the latest HumanMessage.
   * Preserved separately for clarity analysis even as messages grow.
   */
  originalQuery: Annotation<string>({
    reducer: (_, update) => update,
    default: () => ""
  }),

  /**
   * Result of the Clarity Agent's analysis.
   * - "pending": Not yet analyzed
   * - "clear": Query is actionable, company identified
   * - "needs_clarification": Query is ambiguous, interrupt required
   */
  clarityStatus: Annotation<ClarityStatus>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  /**
   * Number of clarification attempts in current query flow.
   * Used for loop protection (max 2 attempts).
   */
  clarificationAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Question to ask user when clarification is needed.
   * Set by Clarity Agent, consumed by Interrupt node.
   */
  clarificationQuestion: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * User's response to clarification request.
   * Separate from originalQuery to preserve research context.
   */
  clarificationResponse: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Extracted/normalized company name from user query.
   * Persisted across turns for follow-up question context.
   */
  detectedCompany: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Research ───
  /**
   * Structured research data from mock/Tavily source.
   * Null if research hasn't run or found no data.
   */
  researchFindings: Annotation<ResearchFindings | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Research Agent's confidence in findings (0-10 scale).
   * - 0-5: Low confidence, requires validation
   * - 6-8: Medium confidence, can proceed to synthesis
   * - 9-10: High confidence
   */
  confidenceScore: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Number of research attempts in current query flow.
   * Incremented by Research Agent, checked by Validator routing.
   * Max 3 attempts before forced synthesis.
   */
  researchAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  // ─── Validation ───
  /**
   * Validator Agent's assessment of research quality.
   * - "pending": Not yet validated
   * - "sufficient": Research adequately answers query
   * - "insufficient": Research needs improvement
   */
  validationResult: Annotation<ValidationResult>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  /**
   * Validator's feedback for improving research.
   * Used by Research Agent on retry to focus search.
   */
  validationFeedback: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Output ───
  /**
   * Final user-facing summary from Synthesis Agent.
   * This is what gets returned to the user.
   */
  finalSummary: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Metadata ───
  /**
   * Currently executing agent for observability/streaming.
   * Updated at the start of each agent.
   */
  currentAgent: Annotation<AgentName>({
    reducer: (_, update) => update,
    default: () => "clarity"
  })
});

// Export the inferred state type for use in agents
export type ResearchState = typeof ResearchStateAnnotation.State;
