import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";
import type { ClarificationInterruptPayload } from "../types/interrupt.js";
import { validateClarificationResponse } from "../types/interrupt.js";

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
 *
 * NOTE: This node does NOT increment clarificationAttempts. The Clarity Agent
 * is responsible for incrementing clarificationAttempts when it determines
 * clarification is needed. This node only reads the value for display purposes.
 */
export async function clarificationInterrupt(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  // ═══════════════════════════════════════════════════════════════════════
  // IDEMPOTENT ZONE: This code runs on EVERY execution (initial + resume)
  // Do NOT put API calls, DB writes, or any side effects here!
  // ═══════════════════════════════════════════════════════════════════════

  const interruptPayload: ClarificationInterruptPayload = {
    type: "clarification_needed",
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

  // Validate and extract the clarification response
  const clarification = validateClarificationResponse(userResponse);

  // DO NOT overwrite originalQuery - preserve research context
  return {
    messages: [new HumanMessage(clarification)],
    clarificationResponse: clarification,
    clarityStatus: "pending",
    currentAgent: "interrupt"
  };
}
