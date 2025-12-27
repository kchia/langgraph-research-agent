/**
 * Route constants for graph conditional edges.
 * Using const object instead of enum for better tree-shaking and type inference.
 */
export const Routes = {
  CLARITY: "clarity",
  INTERRUPT: "interrupt",
  RESEARCH: "research",
  VALIDATOR: "validator",
  SYNTHESIS: "synthesis",
  ERROR_RECOVERY: "error-recovery"
} as const;

/**
 * Union type of all possible routes.
 */
export type Route = (typeof Routes)[keyof typeof Routes];

/**
 * Routes available from the clarity router.
 */
export type ClarityRoute =
  | typeof Routes.INTERRUPT
  | typeof Routes.RESEARCH
  | typeof Routes.ERROR_RECOVERY;

/**
 * Routes available from the research router.
 */
export type ResearchRoute =
  | typeof Routes.VALIDATOR
  | typeof Routes.SYNTHESIS
  | typeof Routes.ERROR_RECOVERY;

/**
 * Routes available from the validation router.
 */
export type ValidationRoute =
  | typeof Routes.RESEARCH
  | typeof Routes.SYNTHESIS
  | typeof Routes.ERROR_RECOVERY;
