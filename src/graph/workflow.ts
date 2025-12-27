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
import { AgentNames } from "./routes.js";

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
      .addNode(
        AgentNames.CLARITY,
        withErrorHandling(AgentNames.CLARITY, clarityAgent)
      )
      .addNode(AgentNames.INTERRUPT, clarificationInterrupt)
      .addNode(
        AgentNames.RESEARCH,
        withErrorHandling(AgentNames.RESEARCH, researchAgent)
      )
      .addNode(
        AgentNames.VALIDATOR,
        withErrorHandling(AgentNames.VALIDATOR, validatorAgent)
      )
      .addNode(
        AgentNames.SYNTHESIS,
        withErrorHandling(AgentNames.SYNTHESIS, synthesisAgent)
      )
      .addNode(AgentNames.ERROR_RECOVERY, errorRecoveryAgent)

      // ─── Entry Edge ───
      .addEdge(START, AgentNames.CLARITY)

      // ─── Clarity Routing ───
      .addConditionalEdges(AgentNames.CLARITY, clarityRouter, {
        [AgentNames.INTERRUPT]: AgentNames.INTERRUPT,
        [AgentNames.RESEARCH]: AgentNames.RESEARCH,
        [AgentNames.ERROR_RECOVERY]: AgentNames.ERROR_RECOVERY
      })

      // ─── Interrupt Resume Edge ───
      // Fixed edge: after resume, always re-analyze in clarity
      .addEdge(AgentNames.INTERRUPT, AgentNames.CLARITY)

      // ─── Research Routing ───
      .addConditionalEdges(AgentNames.RESEARCH, researchRouter, {
        [AgentNames.VALIDATOR]: AgentNames.VALIDATOR,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS,
        [AgentNames.ERROR_RECOVERY]: AgentNames.ERROR_RECOVERY
      })

      // ─── Validation Routing ───
      .addConditionalEdges(AgentNames.VALIDATOR, validationRouter, {
        [AgentNames.RESEARCH]: AgentNames.RESEARCH,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS,
        [AgentNames.ERROR_RECOVERY]: AgentNames.ERROR_RECOVERY
      })

      // ─── Synthesis Terminal Edge ───
      .addEdge(AgentNames.SYNTHESIS, END)

      // ─── Error Recovery Terminal Edge ───
      .addEdge(AgentNames.ERROR_RECOVERY, END)
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
