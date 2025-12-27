import { z } from "zod";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { AgentName } from "./routes.js";
import { AgentNames } from "./routes.js";

// Re-export AgentName for convenience (it's defined in routes.ts)
export type { AgentName } from "./routes.js";

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
 * Zod schema for structured research findings from data sources.
 */
export const ResearchFindingsSchema = z.object({
  /** Normalized company name */
  company: z.string(),

  /** Recent news summary */
  recentNews: z.string().nullable(),

  /** Stock/financial information */
  stockInfo: z.string().nullable(),

  /** Key business developments */
  keyDevelopments: z.string().nullable(),

  /** Data source citations */
  sources: z.array(z.string()),

  /** Raw data for debugging */
  rawData: z.record(z.unknown())
});

/**
 * Structured research findings from data sources
 */
export type ResearchFindings = z.infer<typeof ResearchFindingsSchema>;

/**
 * Zod schema for error context used by error recovery agent.
 */
export const ErrorContextSchema = z.object({
  failedNode: z.string(),
  errorMessage: z.string(),
  isRetryable: z.boolean(),
  originalError: z.unknown().optional()
});

/**
 * Error context type for error recovery agent.
 */
export type ErrorContext = z.infer<typeof ErrorContextSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// REDUCER HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default "last write wins" reducer.
 * Updates replace the previous value entirely.
 */
const lastWriteWins = <T>(_: T, update: T): T => update;

// ═══════════════════════════════════════════════════════════════════════════
// STATE ANNOTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LangGraph State Annotation for the Research Assistant.
 *
 * All fields use the "last write wins" reducer unless otherwise noted.
 * This means updates replace the previous value entirely.
 * Only MessagesAnnotation uses a custom reducer for message merging.
 */
export const ResearchStateAnnotation = Annotation.Root({
  // ─── Conversation ───
  /**
   * Full conversation history for multi-turn support.
   * Uses LangGraph's battle-tested MessagesAnnotation with proper
   * message ID handling, deduplication, and removal support.
   *
   * NOTE: This is the only field with a custom reducer (message merging).
   */
  ...MessagesAnnotation.spec,

  /**
   * Summarized version of older conversation messages.
   * Used when conversation history is too long to fit in token budget.
   * Null if no summarization has been performed yet.
   */
  conversationSummary: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  // ─── Query Analysis ───
  /**
   * The user's original query text, extracted from the latest HumanMessage.
   * Preserved separately for clarity analysis even as messages grow.
   */
  originalQuery: Annotation<string>({
    reducer: lastWriteWins,
    default: () => ""
  }),

  /**
   * Result of the Clarity Agent's analysis.
   * - "pending": Not yet analyzed
   * - "clear": Query is actionable, company identified
   * - "needs_clarification": Query is ambiguous, interrupt required
   */
  clarityStatus: Annotation<ClarityStatus>({
    reducer: lastWriteWins,
    default: () => "pending"
  }),

  /**
   * Number of clarification attempts in current query flow.
   * Used for loop protection (max 2 attempts).
   *
   * IMPORTANT: This is incremented by the Clarity Agent when it determines
   * clarification is needed, NOT by the Interrupt node. The flow is:
   * 1. Clarity Agent analyzes query
   * 2. If clarification needed, Clarity Agent increments clarificationAttempts
   *    and sets clarificationQuestion
   * 3. Router routes to Interrupt node
   * 4. Interrupt node reads clarificationAttempts (does NOT increment)
   * 5. After resume, Clarity Agent runs again and can increment again if needed
   */
  clarificationAttempts: Annotation<number>({
    reducer: lastWriteWins,
    default: () => 0
  }),

  /**
   * Question to ask user when clarification is needed.
   * Set by Clarity Agent, consumed by Interrupt node.
   */
  clarificationQuestion: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  /**
   * User's response to clarification request.
   * Separate from originalQuery to preserve research context.
   */
  clarificationResponse: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  /**
   * Extracted/normalized company name from user query.
   * Persisted across turns for follow-up question context.
   *
   * ## Persistence Behavior
   *
   * This field **persists across queries** to enable natural multi-turn
   * conversations. When a user asks a follow-up question like "What about
   * their stock?" without mentioning the company name, the Clarity Agent
   * uses the previously detected company.
   *
   * ### When detectedCompany Updates
   * - **New company mentioned**: Clarity Agent updates to the new company
   * - **Explicit company change**: User mentions a different company
   * - **Clear context**: User explicitly asks about a different topic
   *
   * ### When detectedCompany Persists
   * - **Follow-up questions**: "What about their revenue?", "Tell me more"
   * - **Related queries**: "How's their stock doing?", "Any recent news?"
   * - **Clarification responses**: After user clarifies, company is preserved
   *
   * ### When detectedCompany Resets
   * - **New conversation**: When `createNewQueryInput()` is called, this field
   *   is NOT automatically reset. The Clarity Agent analyzes the new query
   *   and decides whether to update, preserve, or clear it.
   * - **Agent decision**: Clarity Agent can explicitly set it to null if
   *   context changes significantly.
   *
   * This persistence enables natural conversation flow without requiring users
   * to repeat the company name in every message.
   */
  detectedCompany: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  // ─── Research ───
  /**
   * Structured research data from mock/Tavily source.
   * Null if research hasn't run or found no data.
   */
  researchFindings: Annotation<ResearchFindings | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  /**
   * Research Agent's confidence in findings (0-10 scale).
   * - 0-5: Low confidence, requires validation
   * - 6-8: Medium confidence, can proceed to synthesis
   * - 9-10: High confidence
   */
  confidenceScore: Annotation<number>({
    reducer: lastWriteWins,
    default: () => 0
  }),

  /**
   * Number of research attempts in current query flow.
   * Incremented by Research Agent, checked by Validator routing.
   * Max 3 attempts before forced synthesis.
   */
  researchAttempts: Annotation<number>({
    reducer: lastWriteWins,
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
    reducer: lastWriteWins,
    default: () => "pending"
  }),

  /**
   * Validator's feedback for improving research.
   * Used by Research Agent on retry to focus search.
   */
  validationFeedback: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  // ─── Output ───
  /**
   * Final user-facing summary from Synthesis Agent.
   * This is what gets returned to the user.
   */
  finalSummary: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  // ─── Metadata ───
  /**
   * Currently executing agent for observability/streaming.
   * Updated at the start of each agent.
   */
  currentAgent: Annotation<AgentName>({
    reducer: lastWriteWins,
    default: () => AgentNames.CLARITY
  }),

  // ─── Error Handling ───
  /**
   * Error context for error recovery agent.
   * Set when an unexpected error occurs in a node.
   */
  errorContext: Annotation<ErrorContext | null>({
    reducer: lastWriteWins,
    default: () => null
  }),

  // ─── Observability ───
  /**
   * Correlation ID for request tracking and observability.
   * Generated per request/thread and included in all log entries.
   * Used to trace a single request across all graph nodes.
   */
  correlationId: Annotation<string | null>({
    reducer: lastWriteWins,
    default: () => null
  })
});

// Export the inferred state type for use in agents
export type ResearchState = typeof ResearchStateAnnotation.State;
