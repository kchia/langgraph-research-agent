/**
 * Agent name constants for graph nodes and routing.
 * Using const object instead of enum for better tree-shaking and type inference.
 */
export const AgentNames = {
  CLARITY: "clarity",
  INTERRUPT: "interrupt",
  RESEARCH: "research",
  VALIDATOR: "validator",
  SYNTHESIS: "synthesis",
  ERROR_RECOVERY: "error-recovery"
} as const;

/**
 * Union type of all agent names.
 */
export type AgentName = (typeof AgentNames)[keyof typeof AgentNames];

/**
 * Routes available from the clarity router.
 */
export type ClarityRoute =
  | typeof AgentNames.INTERRUPT
  | typeof AgentNames.RESEARCH
  | typeof AgentNames.ERROR_RECOVERY;

/**
 * Routes available from the research router.
 */
export type ResearchRoute =
  | typeof AgentNames.VALIDATOR
  | typeof AgentNames.SYNTHESIS
  | typeof AgentNames.ERROR_RECOVERY;

/**
 * Routes available from the validation router.
 */
export type ValidationRoute =
  | typeof AgentNames.RESEARCH
  | typeof AgentNames.SYNTHESIS
  | typeof AgentNames.ERROR_RECOVERY;
