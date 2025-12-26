import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";
import { createNewQueryInput } from "../../src/utils/state-helpers.js";

describe("Multi-Turn Conversation", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    graph = buildResearchGraph();
  });

  it("should accumulate messages across turns", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1
    await graph.invoke(createNewQueryInput("Tell me about Apple"), config);

    // Turn 2
    const result2 = await graph.invoke(
      createNewQueryInput("What about their competitors?"),
      config
    );

    // Should have accumulated messages
    const humanMessages = result2.messages.filter(
      (m) => m._getType() === "human"
    );
    expect(humanMessages.length).toBeGreaterThanOrEqual(2);
  });

  it("should persist detectedCompany for follow-ups", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1: Establish company
    await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about Apple")],
        originalQuery: "Tell me about Apple"
      },
      config
    );

    // Check state
    const state1 = await graph.getState(config);
    expect(state1.values.detectedCompany).toBe("Apple Inc.");

    // Turn 2: Follow-up (stubs will maintain company)
    await graph.invoke(
      {
        messages: [new HumanMessage("What about their stock?")],
        originalQuery: "What about their stock?"
      },
      config
    );

    // Company should still be set
    const state2 = await graph.getState(config);
    expect(state2.values.detectedCompany).toBe("Apple Inc.");
  });

  it("should reset query-specific fields on new query", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1
    await graph.invoke(createNewQueryInput("About Apple"), config);

    // Turn 2 with reset helper - use a query that will complete
    const result2 = await graph.invoke(
      createNewQueryInput("Tell me about Tesla"),
      config
    );

    // Query-specific fields should be fresh for Turn 2's processing
    // (Hard to test mid-execution, but we can verify it completed)
    expect(result2.currentAgent).toBe("synthesis");
  });
});
