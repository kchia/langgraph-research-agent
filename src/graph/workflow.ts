import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { ResearchStateAnnotation } from "./state.js";
import { clarityRouter, researchRouter, validationRouter } from "./routers.js";
import {
  clarityAgent,
  researchAgent,
  validatorAgent,
  synthesisAgent,
  clarificationInterrupt,
  errorRecoveryAgent
} from "../agents/index.js";
import { withErrorHandling } from "../utils/error-wrapper.js";

/**
 * Builds and compiles the Research Assistant workflow graph.
 *
 * Graph structure:
 * START → clarity → [interrupt OR research]
 *                         ↓
 *         interrupt → clarity (loop back)
 *         research → [validator OR synthesis]
 *                         ↓
 *         validator → [research (retry) OR synthesis]
 *         synthesis → END
 */
/**
 * Build the research workflow graph (uncompiled).
 * Use compileResearchGraph() to get a compiled graph with checkpointing.
 */
export function buildResearchWorkflow() {
  return (
    new StateGraph(ResearchStateAnnotation)
      // ─── Node Definitions ───
      // Main agents are wrapped with error handling to catch unhandled exceptions
      // and route them to error-recovery. Interrupt and error-recovery are NOT
      // wrapped: interrupt uses special interrupt() behavior, error-recovery
      // would create infinite loops if wrapped.
      .addNode("clarity", withErrorHandling("clarity", clarityAgent))
      .addNode("interrupt", clarificationInterrupt)
      .addNode("research", withErrorHandling("research", researchAgent))
      .addNode("validator", withErrorHandling("validator", validatorAgent))
      .addNode("synthesis", withErrorHandling("synthesis", synthesisAgent))
      .addNode("error-recovery", errorRecoveryAgent)

      // ─── Entry Edge ───
      .addEdge(START, "clarity")

      // ─── Clarity Routing ───
      .addConditionalEdges("clarity", clarityRouter, {
        interrupt: "interrupt",
        research: "research",
        "error-recovery": "error-recovery"
      })

      // ─── Interrupt Resume Edge ───
      // Fixed edge: after resume, always re-analyze in clarity
      .addEdge("interrupt", "clarity")

      // ─── Research Routing ───
      .addConditionalEdges("research", researchRouter, {
        validator: "validator",
        synthesis: "synthesis",
        "error-recovery": "error-recovery"
      })

      // ─── Validation Routing ───
      .addConditionalEdges("validator", validationRouter, {
        research: "research",
        synthesis: "synthesis",
        "error-recovery": "error-recovery"
      })

      // ─── Synthesis Terminal Edge ───
      .addEdge("synthesis", END)

      // ─── Error Recovery Terminal Edge ───
      .addEdge("error-recovery", END)
  );
}

/**
 * Compile the research workflow with a checkpointer.
 *
 * @param checkpointer - Checkpointer for state persistence (required)
 * @throws Error if checkpointer is null or undefined
 */
export function compileResearchGraph(checkpointer: BaseCheckpointSaver) {
  if (!checkpointer) {
    throw new Error(
      "Checkpointer is required for graph compilation. " +
        "Provide a valid BaseCheckpointSaver instance (e.g., MemorySaver or SqliteSaver)."
    );
  }

  const workflow = buildResearchWorkflow();
  return workflow.compile({ checkpointer });
}

export type ResearchGraph = ReturnType<typeof compileResearchGraph>;
