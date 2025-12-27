import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { Command, MemorySaver } from "@langchain/langgraph";

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP - Must be before imports that use the mocked modules
// ═══════════════════════════════════════════════════════════════════════════

// Use vi.hoisted to ensure mocks are available before vi.mock runs
const mocks = vi.hoisted(() => {
  const mockClarityResponse = {
    is_clear: true,
    detected_company: "Apple Inc.",
    clarification_needed: null,
    reasoning: "Query mentions Apple, a well-known company"
  };

  const mockValidatorSufficient = {
    is_sufficient: true,
    feedback: null,
    reasoning: "Findings are comprehensive"
  };

  const mockSynthesisResponse = "**Apple Inc. Summary**\n\nApple continues to lead in innovation.";

  const mockSearchResultApple = {
    company: "Apple Inc.",
    recentNews: "Apple announced new features",
    stockInfo: "AAPL at $180",
    keyDevelopments: "AI expansion",
    sources: ["reuters.com", "bloomberg.com"],
    confidence: 8
  };

  // Create mock functions
  const clarityInvoke = vi.fn().mockResolvedValue(mockClarityResponse);
  const validatorInvoke = vi.fn().mockResolvedValue(mockValidatorSufficient);
  const synthesisInvoke = vi.fn().mockResolvedValue({ content: mockSynthesisResponse });
  const dataSourceSearch = vi.fn().mockResolvedValue(mockSearchResultApple);

  return {
    mockClarityResponse,
    mockValidatorSufficient,
    mockSynthesisResponse,
    mockSearchResultApple,
    clarityInvoke,
    validatorInvoke,
    synthesisInvoke,
    dataSourceSearch,
    clarityLLM: {
      invoke: clarityInvoke,
      withStructuredOutput: vi.fn().mockReturnValue({ invoke: clarityInvoke }),
      _invoke: clarityInvoke
    },
    validatorLLM: {
      invoke: validatorInvoke,
      withStructuredOutput: vi.fn().mockReturnValue({ invoke: validatorInvoke }),
      _invoke: validatorInvoke
    },
    synthesisLLM: {
      invoke: synthesisInvoke,
      _invoke: synthesisInvoke
    },
    dataSource: {
      search: dataSourceSearch,
      getName: vi.fn().mockReturnValue("Mock Source"),
      isAvailable: vi.fn().mockReturnValue(true),
      _search: dataSourceSearch
    }
  };
});

vi.mock("../../src/utils/llm-factory.js", () => ({
  getLLM: vi.fn().mockImplementation((agentType: string) => {
    switch (agentType) {
      case "clarity": return mocks.clarityLLM;
      case "validator": return mocks.validatorLLM;
      case "synthesis": return mocks.synthesisLLM;
      default: return mocks.synthesisLLM;
    }
  }),
  supportsStructuredOutput: vi.fn().mockReturnValue(true),
  clearLLMCache: vi.fn()
}));

vi.mock("../../src/sources/index.js", () => ({
  createDataSource: vi.fn().mockReturnValue(mocks.dataSource)
}));

// Now import the modules that depend on the mocked ones
import {
  compileResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";
import { createNewQueryInput } from "../../src/utils/state-helpers.js";
import { AgentNames } from "../../src/graph/routes.js";

/**
 * Comprehensive integration tests demonstrating full workflow scenarios.
 * Uses mocked LLM and data source for fast, deterministic tests.
 */
describe("Full Workflow Integration", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mocks.clarityLLM._invoke.mockResolvedValue(mocks.mockClarityResponse);
    mocks.validatorLLM._invoke.mockResolvedValue(mocks.mockValidatorSufficient);
    mocks.synthesisLLM._invoke.mockResolvedValue({ content: mocks.mockSynthesisResponse });
    mocks.dataSource._search.mockResolvedValue(mocks.mockSearchResultApple);

    graph = compileResearchGraph(new MemorySaver());
  });

  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe("Multi-Turn Conversation with Clarification", () => {
    it("should handle: vague query → clarification → research → follow-up", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      // Setup: First call needs clarification, second call detects Apple
      const mockNeedsClarification = {
        is_clear: false,
        detected_company: null,
        clarification_needed: "Which company would you like to know about?",
        reasoning: "Query is ambiguous"
      };
      mocks.clarityLLM._invoke
        .mockResolvedValueOnce(mockNeedsClarification)
        .mockResolvedValue(mocks.mockClarityResponse);

      // Turn 1: Vague query
      const result1 = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about the company")],
          originalQuery: "Tell me about the company"
        },
        config
      );

      expect(result1.clarityStatus).toBe("needs_clarification");
      expect(result1.clarificationQuestion).toBeDefined();

      const state1 = await graph.getState(config);
      expect(state1.next).toContain(AgentNames.INTERRUPT);

      // Resume with company name
      const result2 = await graph.invoke(
        new Command({ resume: "Apple" }),
        config
      );

      expect(result2.detectedCompany).toBe("Apple Inc.");
      expect(result2.finalSummary).toBeDefined();
      expect(result2.currentAgent).toBe(AgentNames.SYNTHESIS);

      const state2 = await graph.getState(config);
      expect(state2.next).toEqual([]);

      // Turn 2: Follow-up
      const result3 = await graph.invoke(
        createNewQueryInput("What about their stock price?"),
        config
      );

      expect(result3.detectedCompany).toBe("Apple Inc.");
      expect(result3.finalSummary).toBeDefined();

      const humanMessages = result3.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(humanMessages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Validation Retry Loop", () => {
    it("should exercise validation and retry with mock data", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const mockTeslaClarityResponse = {
        is_clear: true,
        detected_company: "Tesla, Inc.",
        clarification_needed: null,
        reasoning: "Query mentions Tesla"
      };

      const mockPartialResult = {
        company: "Tesla, Inc.",
        recentNews: "Limited",
        stockInfo: null,
        keyDevelopments: null,
        sources: ["google.com"],
        confidence: 3
      };

      const mockFullResult = {
        company: "Tesla, Inc.",
        recentNews: "Tesla reports record deliveries",
        stockInfo: "TSLA at $250",
        keyDevelopments: "Expanding Supercharger network",
        sources: ["reuters.com", "electrek.co"],
        confidence: 7
      };

      const mockInsufficient = {
        is_sufficient: false,
        feedback: "Need more sources",
        reasoning: "Missing key info"
      };

      mocks.clarityLLM._invoke.mockResolvedValue(mockTeslaClarityResponse);
      mocks.dataSource._search
        .mockResolvedValueOnce(mockPartialResult)
        .mockResolvedValue(mockFullResult);
      mocks.validatorLLM._invoke
        .mockResolvedValueOnce(mockInsufficient)
        .mockResolvedValue(mocks.mockValidatorSufficient);
      mocks.synthesisLLM._invoke.mockResolvedValue({ content: "Tesla summary" });

      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Tesla")],
          originalQuery: "Tell me about Tesla"
        },
        config
      );

      expect(result.detectedCompany).toBe("Tesla, Inc.");
      expect(result.finalSummary).toBeDefined();
      expect(result.currentAgent).toBe(AgentNames.SYNTHESIS);
      expect(result.researchAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Complete Conversation Flow", () => {
    it("should demonstrate 2+ conversation turns as required by spec", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const turn1 = await graph.invoke(
        createNewQueryInput("What's the latest news about Apple?"),
        config
      );

      expect(turn1.detectedCompany).toBe("Apple Inc.");
      expect(turn1.finalSummary).toBeDefined();

      const turn2 = await graph.invoke(
        createNewQueryInput("What about their competitors?"),
        config
      );

      expect(turn2.detectedCompany).toBe("Apple Inc.");
      expect(turn2.finalSummary).toBeDefined();

      const allHumanMessages = turn2.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(allHumanMessages.length).toBe(2);
    });

    it("should switch company context when explicitly mentioned", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const turn1 = await graph.invoke(
        createNewQueryInput("Tell me about Apple"),
        config
      );
      expect(turn1.detectedCompany).toBe("Apple Inc.");

      // Switch to Tesla
      const mockTeslaClarity = {
        is_clear: true,
        detected_company: "Tesla, Inc.",
        clarification_needed: null,
        reasoning: "Mentions Tesla"
      };
      const mockTeslaResult = {
        company: "Tesla, Inc.",
        recentNews: "Tesla news",
        stockInfo: "TSLA",
        keyDevelopments: "EV expansion",
        sources: ["reuters.com"],
        confidence: 7
      };

      mocks.clarityLLM._invoke.mockResolvedValue(mockTeslaClarity);
      mocks.dataSource._search.mockResolvedValue(mockTeslaResult);
      mocks.synthesisLLM._invoke.mockResolvedValue({ content: "Tesla summary" });

      const turn2 = await graph.invoke(
        createNewQueryInput("Now tell me about Tesla instead"),
        config
      );
      expect(turn2.detectedCompany).toBe("Tesla, Inc.");
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown company gracefully", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      mocks.clarityLLM._invoke.mockResolvedValue({
        is_clear: true,
        detected_company: "XyzCorp",
        clarification_needed: null,
        reasoning: "User asked about XyzCorp"
      });
      mocks.dataSource._search.mockResolvedValue({
        company: "XyzCorp",
        recentNews: "Limited info",
        stockInfo: null,
        keyDevelopments: null,
        sources: ["google.com"],
        confidence: 3
      });

      const result = await graph.invoke(
        createNewQueryInput("Tell me about XyzCorp"),
        config
      );

      expect(result.currentAgent).toBe(AgentNames.SYNTHESIS);
      expect(result.finalSummary).toBeDefined();
    });

    it("should maintain separate state for different threads", async () => {
      const config1 = { configurable: { thread_id: crypto.randomUUID() } };
      const config2 = { configurable: { thread_id: crypto.randomUUID() } };

      await graph.invoke(createNewQueryInput("Tell me about Apple"), config1);

      // Switch to Tesla for thread 2
      const mockTeslaClarity = {
        is_clear: true,
        detected_company: "Tesla, Inc.",
        clarification_needed: null,
        reasoning: "Mentions Tesla"
      };
      mocks.clarityLLM._invoke.mockResolvedValue(mockTeslaClarity);
      mocks.dataSource._search.mockResolvedValue({
        company: "Tesla, Inc.",
        recentNews: "Tesla news",
        stockInfo: "TSLA",
        keyDevelopments: "EV",
        sources: ["reuters.com"],
        confidence: 7
      });

      await graph.invoke(createNewQueryInput("Tell me about Tesla"), config2);

      const state1 = await graph.getState(config1);
      const state2 = await graph.getState(config2);

      expect(state1.values.detectedCompany).toBe("Apple Inc.");
      expect(state2.values.detectedCompany).toBe("Tesla, Inc.");
    });
  });
});
