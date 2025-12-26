import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { ResearchStateAnnotation } from "./state.js";
import { clarityRouter, researchRouter, validationRouter } from "./routers.js";
import {
  clarityAgent,
  researchAgent,
  validatorAgent,
  synthesisAgent,
  clarificationInterrupt
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
  return new StateGraph(ResearchStateAnnotation)
    // ─── Node Definitions ───
    .addNode("clarity", clarityAgent)
    .addNode("interrupt", clarificationInterrupt)
    .addNode("research", researchAgent)
    .addNode("validator", validatorAgent)
    .addNode("synthesis", synthesisAgent)

    // ─── Entry Edge ───
    .addEdge(START, "clarity")

    // ─── Clarity Routing ───
    .addConditionalEdges("clarity", clarityRouter, {
      interrupt: "interrupt",
      research: "research"
    })

    // ─── Interrupt Resume Edge ───
    // Fixed edge: after resume, always re-analyze in clarity
    .addEdge("interrupt", "clarity")

    // ─── Research Routing ───
    .addConditionalEdges("research", researchRouter, {
      validator: "validator",
      synthesis: "synthesis"
    })

    // ─── Validation Routing ───
    .addConditionalEdges("validator", validationRouter, {
      research: "research",
      synthesis: "synthesis"
    })

    // ─── Synthesis Terminal Edge ───
    .addEdge("synthesis", END);
}

/**
 * Compile the research workflow with a checkpointer.
 *
 * @param checkpointer - Checkpointer for state persistence (required)
 */
export function compileResearchGraph(checkpointer: BaseCheckpointSaver) {
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
