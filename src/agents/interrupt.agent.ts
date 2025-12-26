import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * Interrupt node that pauses for user clarification.
 *
 * CRITICAL: This entire function RE-EXECUTES when resumed!
 *
 * When resumed:
 * 1. Function starts from the beginning
 * 2. Code before interrupt() runs again
 * 3. interrupt() returns the resume value instead of pausing
 * 4. Code after interrupt() executes
 *
 * Therefore: Keep code before interrupt() IDEMPOTENT (no side effects).
 */
export async function clarificationInterrupt(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  // ═══════════════════════════════════════════════════════════════════════
  // IDEMPOTENT ZONE: This code runs on EVERY execution (initial + resume)
  // Do NOT put API calls, DB writes, or any side effects here!
  // ═══════════════════════════════════════════════════════════════════════

  const interruptPayload = {
    type: "clarification_needed" as const,
    question:
      state.clarificationQuestion ?? "Which company are you asking about?",
    originalQuery: state.originalQuery,
    attempt: state.clarificationAttempts
  };

  // Execution PAUSES here on first run.
  // On resume, this RETURNS the value from Command({ resume: value }).
  const userResponse = interrupt(interruptPayload);

  // ═══════════════════════════════════════════════════════════════════════
  // SAFE ZONE: This code ONLY runs after resume
  // ═══════════════════════════════════════════════════════════════════════

  return {
    messages: [new HumanMessage(userResponse as string)],
    originalQuery: userResponse as string,
    clarityStatus: "pending",
    currentAgent: "interrupt"
  };
}
