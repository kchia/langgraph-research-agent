import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";

// Skip if no API key (these tests require real LLM)
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

describe("Happy Path Integration", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    graph = buildResearchGraph();
  });

  describe.skipIf(!hasApiKey)("with real LLM", () => {
    it("should complete research for known company", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const result = await graph.invoke(
        {
          messages: [new HumanMessage("What's happening with Apple?")],
          originalQuery: "What's happening with Apple?"
        },
        config
      );

      expect((result as any).__interrupt__).toBeUndefined();
      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toMatch(/apple/i);
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary!.length).toBeGreaterThan(50);
    }, 30000);

    it("should complete research for Tesla", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Tesla")],
          originalQuery: "Tell me about Tesla"
        },
        config
      );

      expect(result.detectedCompany).toMatch(/tesla/i);
      expect(result.finalSummary).toBeDefined();
    }, 30000);
  });

  describe("with mock data (no API key needed)", () => {
    it("should handle unknown company gracefully", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      // Simulate a scenario where clarification was already attempted
      // This tests graceful handling after clarification attempts are exhausted
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about some company")],
          originalQuery: "Tell me about some company",
          clarificationAttempts: 1 // Simulate that clarification was already attempted
        },
        config
      );

      // Graph should complete without crashing
      expect(result.currentAgent).toBe("synthesis");
      expect(result.finalSummary).toBeDefined();
    });
  });
});
