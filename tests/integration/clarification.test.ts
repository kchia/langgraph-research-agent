import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import {
  ResearchStateAnnotation,
  type ResearchState
} from "../../src/graph/state.js";
import { clarityRouter } from "../../src/graph/routers.js";
import { clarificationInterrupt } from "../../src/agents/interrupt.agent.js";

/**
 * Build a minimal graph to test interrupt flow specifically.
 * Uses controllable stub for clarity to force interrupt scenarios.
 */
function buildInterruptTestGraph(
  clarityBehavior: (state: ResearchState) => Partial<ResearchState>
) {
  const workflow = new StateGraph(ResearchStateAnnotation)
    .addNode("clarity", clarityBehavior)
    .addNode("interrupt", clarificationInterrupt)
    .addNode("end", (state) => ({
      finalSummary: `Completed for ${state.detectedCompany}`
    }))
    .addEdge(START, "clarity")
    .addConditionalEdges("clarity", clarityRouter, {
      interrupt: "interrupt",
      research: "end"
    })
    .addEdge("interrupt", "clarity")
    .addEdge("end", END);

  return workflow.compile({ checkpointer: new MemorySaver() });
}

describe("Interrupt Flow Integration", () => {
  it("should interrupt for unclear query and resume correctly", async () => {
    let callCount = 0;

    // First call: needs clarification. Second call: clear.
    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount === 1) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion: "Which company?",
          clarificationAttempts: 1,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: state.originalQuery, // Use the resumed query as company
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const config = { configurable: { thread_id: "interrupt-test-1" } };

    // Initial query - should interrupt
    const result1 = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about the company")],
        originalQuery: "Tell me about the company"
      },
      config
    );

    // Check that interrupt occurred by examining graph state
    // When interrupt occurs, graph state shows next node is "interrupt"
    const state1 = await graph.getState(config);
    expect(state1.next).toContain("interrupt");
    expect(result1.clarificationQuestion).toBe("Which company?");

    // Resume with clarification
    const result2 = await graph.invoke(
      new Command({ resume: "Apple" }),
      config
    );

    // After resume, graph should complete (no pending interrupt)
    const state2 = await graph.getState(config);
    expect(state2.next).toEqual([]);
    expect(result2.finalSummary).toContain("Apple");
  });

  it("should handle double clarification", async () => {
    let callCount = 0;

    // First two calls need clarification, third is clear
    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount <= 2) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion:
            callCount === 1 ? "Which company?" : "Can you be more specific?",
          clarificationAttempts: callCount,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const config = { configurable: { thread_id: "double-interrupt-test" } };

    // First query
    const result1 = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me")],
        originalQuery: "Tell me"
      },
      config
    );
    // Check that interrupt occurred
    const state1 = await graph.getState(config);
    expect(state1.next).toContain("interrupt");
    expect(result1.clarificationQuestion).toBe("Which company?");

    // First resume - still unclear
    const result2 = await graph.invoke(
      new Command({ resume: "the tech one" }),
      config
    );
    // Should interrupt again
    const state2 = await graph.getState(config);
    expect(state2.next).toContain("interrupt");
    expect(result2.clarificationQuestion).toContain("specific");

    // Second resume - now clear
    const result3 = await graph.invoke(
      new Command({ resume: "Apple Inc." }),
      config
    );
    // Should complete (no pending interrupt)
    const state3 = await graph.getState(config);
    expect(state3.next).toEqual([]);
    expect(result3.finalSummary).toContain("Apple");
  });

  it("should use same thread_id to maintain state", async () => {
    let callCount = 0;

    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount === 1) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion: "Which company?",
          clarificationAttempts: 1,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: "Apple",
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const threadId = "thread-state-test";

    // Initial with thread ID
    await graph.invoke(
      {
        messages: [new HumanMessage("Query")],
        originalQuery: "Query"
      },
      { configurable: { thread_id: threadId } }
    );

    // Resume with SAME thread ID should work
    const correctThreadResult = await graph.invoke(
      new Command({ resume: "Apple" }),
      { configurable: { thread_id: threadId } }
    );

    expect(correctThreadResult.finalSummary).toContain("Apple");
  });
});
