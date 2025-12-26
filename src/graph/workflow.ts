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
      .addNode("clarity", clarityAgent)
      .addNode("interrupt", clarificationInterrupt)
      .addNode("research", researchAgent)
      .addNode("validator", validatorAgent)
      .addNode("synthesis", synthesisAgent)
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

/**
 * Backward-compatible function that builds and compiles the graph.
 * Uses the provided checkpointer for state persistence.
 *
 * @deprecated Use compileResearchGraph() with explicit checkpointer instead
 */
export function buildResearchGraph(checkpointer: BaseCheckpointSaver) {
  return compileResearchGraph(checkpointer);
}

export type ResearchGraph = ReturnType<typeof buildResearchGraph>;
