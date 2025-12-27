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

  const mockSynthesisResponse = "**Apple Inc. Summary**\n\nApple continues to lead in innovation.";
  const mockSynthesisTesla = "**Tesla, Inc. Summary**\n\nTesla maintains its position as a leader in EVs.";

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
  const synthesisInvoke = vi.fn().mockResolvedValue({ content: mockSynthesisResponse });
  const dataSourceSearch = vi.fn().mockResolvedValue(mockSearchResultApple);

  return {
    mockClarityResponse,
    mockClarityTesla,
    mockValidatorSufficient,
    mockSynthesisResponse,
    mockSynthesisTesla,
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

describe("Multi-Turn Conversation", () => {
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
    // Ensure all async operations and streams are fully closed
    await new Promise((resolve) => setImmediate(resolve));
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

    // Turn 2: Follow-up (mocks will maintain company)
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

    // Setup for Tesla in Turn 2
    mocks.clarityLLM._invoke.mockResolvedValue(mocks.mockClarityTesla);
    mocks.dataSource._search.mockResolvedValue(mocks.mockSearchResultTesla);
    mocks.synthesisLLM._invoke.mockResolvedValue({ content: mocks.mockSynthesisTesla });

    // Turn 2 with reset helper - use a query that will complete
    const result2 = await graph.invoke(
      createNewQueryInput("Tell me about Tesla"),
      config
    );

    // Query-specific fields should be fresh for Turn 2's processing
    expect(result2.currentAgent).toBe(AgentNames.SYNTHESIS);
  });
});
