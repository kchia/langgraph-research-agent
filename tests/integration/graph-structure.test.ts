import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP - Must be before imports that use the mocked modules
// ═══════════════════════════════════════════════════════════════════════════

const mocks = vi.hoisted(() => {
  const mockClarityResponse = {
    is_clear: true,
    detected_company: "Apple Inc.",
    clarification_question: null,
    reasoning: "Query mentions Apple, a well-known company"
  };

  const mockClarityTesla = {
    is_clear: true,
    detected_company: "Tesla, Inc.",
    clarification_question: null,
    reasoning: "Query mentions Tesla, a well-known company"
  };

  const mockValidatorSufficient = {
    is_sufficient: true,
    feedback: null,
    reasoning: "Findings are comprehensive"
  };

  const mockSynthesisResponse =
    "**Apple Inc. Summary**\n\nApple continues to lead in innovation.";

  const mockSearchResultApple = {
    company: "Apple Inc.",
    recentNews: "Apple announced new features",
    stockInfo: "AAPL at $180",
    keyDevelopments: "AI expansion",
    sources: ["reuters.com", "bloomberg.com"],
    confidence: 8
  };

  const mockSearchResultTesla = {
    company: "Tesla, Inc.",
    recentNews: "Tesla reports record vehicle deliveries",
    stockInfo: "TSLA at $250",
    keyDevelopments: "Expanding Supercharger network",
    sources: ["reuters.com", "electrek.co"],
    confidence: 7
  };

  const clarityInvoke = vi.fn().mockResolvedValue(mockClarityResponse);
  const validatorInvoke = vi.fn().mockResolvedValue(mockValidatorSufficient);
  const synthesisInvoke = vi
    .fn()
    .mockResolvedValue({ content: mockSynthesisResponse });
  const dataSourceSearch = vi.fn().mockResolvedValue(mockSearchResultApple);

  return {
    mockClarityResponse,
    mockClarityTesla,
    mockValidatorSufficient,
    mockSynthesisResponse,
    mockSearchResultApple,
    mockSearchResultTesla,
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
      withStructuredOutput: vi
        .fn()
        .mockReturnValue({ invoke: validatorInvoke }),
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
      case "clarity":
        return mocks.clarityLLM;
      case "validator":
        return mocks.validatorLLM;
      case "synthesis":
        return mocks.synthesisLLM;
      default:
        return mocks.synthesisLLM;
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
import { AgentNames } from "../../src/graph/routes.js";

describe("Graph Structure", () => {
  let graph: ResearchGraph;
  let threadId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mocks.clarityLLM._invoke.mockResolvedValue(mocks.mockClarityResponse);
    mocks.validatorLLM._invoke.mockResolvedValue(mocks.mockValidatorSufficient);
    mocks.synthesisLLM._invoke.mockResolvedValue({
      content: mocks.mockSynthesisResponse
    });
    mocks.dataSource._search.mockResolvedValue(mocks.mockSearchResultApple);

    graph = compileResearchGraph(new MemorySaver());
    threadId = crypto.randomUUID();
  });

  afterEach(async () => {
    // Ensure all streams and async operations are fully closed
    await new Promise((resolve) => setImmediate(resolve));
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
      expect(result.currentAgent).toBe(AgentNames.SYNTHESIS);
      expect(result.finalSummary).toContain("Apple");

      // Should not have interrupted (check graph state)
      const state = await graph.getState(getConfig());
      expect(state.next).toEqual([]);
    });

    it("should track agent progression correctly", async () => {
      // Setup for Tesla
      mocks.clarityLLM._invoke.mockResolvedValue(mocks.mockClarityTesla);
      mocks.dataSource._search.mockResolvedValue(mocks.mockSearchResultTesla);

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
      expect(agents).toContain(AgentNames.CLARITY);
      expect(agents).toContain(AgentNames.RESEARCH);
      expect(agents).toContain(AgentNames.SYNTHESIS);
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

      // Setup for Tesla in thread 2
      mocks.clarityLLM._invoke.mockResolvedValue(mocks.mockClarityTesla);
      mocks.dataSource._search.mockResolvedValue(mocks.mockSearchResultTesla);

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
