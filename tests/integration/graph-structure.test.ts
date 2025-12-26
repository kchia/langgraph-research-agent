import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";

describe("Graph Structure", () => {
  let graph: ResearchGraph;
  let threadId: string;

  beforeEach(() => {
    graph = buildResearchGraph();
    threadId = crypto.randomUUID();
  });

  function getConfig() {
    return { configurable: { thread_id: threadId } };
  }

  describe("compilation", () => {
    it("should compile without errors", () => {
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });
  });

  describe("happy path with stubs", () => {
    it("should complete full flow and reach synthesis", async () => {
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Apple")],
          originalQuery: "Tell me about Apple"
        },
        getConfig()
      );

      // Should have reached synthesis
      expect(result.currentAgent).toBe("synthesis");
      expect(result.finalSummary).toContain("Apple");

      // Should not have interrupted
      expect(result.__interrupt__).toBeUndefined();
    });

    it("should track agent progression correctly", async () => {
      const agents: string[] = [];

      const stream = await graph.stream(
        {
          messages: [new HumanMessage("Tell me about Tesla")],
          originalQuery: "Tell me about Tesla"
        },
        { ...getConfig(), streamMode: "updates" }
      );

      for await (const update of stream) {
        const [nodeName] = Object.keys(update);
        if (nodeName && nodeName !== "__start__") {
          agents.push(nodeName);
        }
      }

      // Stub path: clarity → research → synthesis (high confidence skips validator)
      expect(agents).toContain("clarity");
      expect(agents).toContain("research");
      expect(agents).toContain("synthesis");
    });
  });

  describe("state persistence", () => {
    it("should persist messages across invocations (append reducer)", async () => {
      const config = getConfig();

      await graph.invoke(
        {
          messages: [new HumanMessage("First message")],
          originalQuery: "First message"
        },
        config
      );

      const result2 = await graph.invoke(
        {
          messages: [new HumanMessage("Second message")],
          originalQuery: "Second message"
        },
        config
      );

      // Messages should accumulate
      const humanMessages = result2.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(humanMessages.length).toBeGreaterThanOrEqual(2);
    });

    it("should persist detectedCompany across invocations", async () => {
      const config = getConfig();

      await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Apple")],
          originalQuery: "Tell me about Apple"
        },
        config
      );

      // Get state directly
      const state = await graph.getState(config);
      expect(state.values.detectedCompany).toBe("Apple Inc.");
    });

    it("should use separate state for different thread IDs", async () => {
      const config1 = { configurable: { thread_id: "thread-1" } };
      const config2 = { configurable: { thread_id: "thread-2" } };

      await graph.invoke(
        {
          messages: [new HumanMessage("About Apple")],
          originalQuery: "About Apple"
        },
        config1
      );

      const result2 = await graph.invoke(
        {
          messages: [new HumanMessage("About Tesla")],
          originalQuery: "About Tesla"
        },
        config2
      );

      // Thread 2 should not have Thread 1's messages
      const humanMessages = result2.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(humanMessages.length).toBe(1);
    });
  });
});
