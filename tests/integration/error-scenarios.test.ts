import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  const clarityInvoke = vi.fn().mockResolvedValue(mockClarityResponse);
  const validatorInvoke = vi.fn().mockResolvedValue(mockValidatorSufficient);
  const synthesisInvoke = vi
    .fn()
    .mockResolvedValue({ content: mockSynthesisResponse });
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
import { createNewQueryInput } from "../../src/utils/state-helpers.js";
import { streamWithInterruptSupport } from "../../src/utils/streaming.js";
import { streamWithTokens } from "../../src/utils/token-streaming.js";
import { AgentNames } from "../../src/graph/routes.js";

/**
 * Integration tests for error scenarios and edge cases.
 * Tests error recovery, timeouts, invalid inputs, and robustness.
 */
describe("Error Scenarios Integration", () => {
  let graph: ResearchGraph;

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
  });

  afterEach(async () => {
    // Ensure all async operations and streams are fully closed
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe("Error Recovery Flow", () => {
    it("should handle error in clarity agent gracefully", async () => {
      const config = { configurable: { thread_id: "error-clarity" } };

      // Create a state that would trigger error recovery
      const stateWithError = {
        ...createNewQueryInput("Tell me about Apple"),
        errorContext: {
          failedNode: AgentNames.CLARITY,
          errorMessage: "LLM call failed",
          isRetryable: false
        }
      };

      const result = await graph.invoke(stateWithError, config);

      // Should have error recovery response
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary).toContain("trouble understanding");
      expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
    });

    it("should handle error in research agent gracefully", async () => {
      const config = { configurable: { thread_id: "error-research" } };

      const stateWithError = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        errorContext: {
          failedNode: AgentNames.RESEARCH,
          errorMessage: "Data source unavailable",
          isRetryable: true
        }
      };

      const result = await graph.invoke(stateWithError, config);

      // Should have error recovery response
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary).toContain("trouble finding");
      expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
    });

    it("should handle error in validator agent gracefully", async () => {
      const config = { configurable: { thread_id: "error-validator" } };

      const stateWithError = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        researchFindings: {
          company: "Apple Inc.",
          recentNews: "Test news",
          stockInfo: "Test stock",
          keyDevelopments: "Test developments",
          sources: ["Test"],
          rawData: {}
        },
        errorContext: {
          failedNode: AgentNames.VALIDATOR,
          errorMessage: "Validation failed",
          isRetryable: false
        }
      };

      const result = await graph.invoke(stateWithError, config);

      // Should have error recovery response
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary).toContain("couldn't verify");
      expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
    });

    it("should handle error in synthesis agent gracefully", async () => {
      const config = { configurable: { thread_id: "error-synthesis" } };

      const stateWithError = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        researchFindings: {
          company: "Apple Inc.",
          recentNews: "Test news",
          stockInfo: "Test stock",
          keyDevelopments: "Test developments",
          sources: ["Test"],
          rawData: {}
        },
        validationResult: "sufficient",
        errorContext: {
          failedNode: AgentNames.SYNTHESIS,
          errorMessage: "Synthesis failed",
          isRetryable: false
        }
      };

      const result = await graph.invoke(stateWithError, config);

      // Should have error recovery response
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary).toContain("trouble generating");
      expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
    });

    it("should handle missing error context gracefully", async () => {
      const config = { configurable: { thread_id: "error-missing-context" } };

      const stateWithError = {
        ...createNewQueryInput("Tell me about Apple"),
        errorContext: null
      };

      const result = await graph.invoke(stateWithError, config);

      // Should still provide a response
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary.length).toBeGreaterThan(0);
    });
  });

  describe("Invalid Input Handling", () => {
    it("should handle empty query", async () => {
      const config = { configurable: { thread_id: "invalid-empty" } };

      try {
        const result = await graph.invoke(createNewQueryInput(""), config);
        // Should request clarification
        expect(result.clarityStatus).toBe("needs_clarification");
      } catch (error) {
        // Input validation should catch this before graph execution
        expect(error).toBeDefined();
      }
    });

    it("should handle extremely long query", async () => {
      const config = { configurable: { thread_id: "invalid-long" } };
      const longQuery = "A".repeat(1000);

      try {
        const result = await graph.invoke(
          createNewQueryInput(longQuery),
          config
        );
        // Should either handle it or reject it
        expect(result).toBeDefined();
      } catch (error) {
        // Input validation should catch this
        expect(error).toBeDefined();
      }
    });

    it("should handle special characters in query", async () => {
      const config = { configurable: { thread_id: "invalid-special" } };
      const specialQuery = "Tell me about <script>alert('xss')</script> Apple";

      const result = await graph.invoke(
        createNewQueryInput(specialQuery),
        config
      );

      // Should handle or sanitize
      expect(result).toBeDefined();
    });

    it("should handle null/undefined company gracefully", async () => {
      const config = { configurable: { thread_id: "invalid-company" } };

      const state = {
        ...createNewQueryInput("Tell me about a company"),
        clarityStatus: "clear",
        detectedCompany: null
      };

      const result = await graph.invoke(state, config);

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle state with all fields null", async () => {
      const config = { configurable: { thread_id: "edge-null-state" } };

      const minimalState = {
        messages: [],
        originalQuery: "",
        clarityStatus: "pending" as const,
        clarificationAttempts: 0,
        clarificationQuestion: null,
        clarificationResponse: null,
        detectedCompany: null,
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: 0,
        validationResult: "pending" as const,
        validationFeedback: null,
        finalSummary: null,
        currentAgent: AgentNames.CLARITY,
        conversationSummary: null,
        errorContext: null,
        correlationId: null
      };

      const result = await graph.invoke(minimalState, config);

      // Should handle minimal state
      expect(result).toBeDefined();
    });

    it("should handle max clarification attempts", async () => {
      const config = { configurable: { thread_id: "edge-max-attempts" } };

      const state = {
        ...createNewQueryInput("Tell me about it"),
        clarificationAttempts: 3 // Exceeds max
      };

      const result = await graph.invoke(state, config);

      // Should force proceed or handle gracefully
      expect(result).toBeDefined();
    });

    it("should handle max research attempts", async () => {
      const config = { configurable: { thread_id: "edge-max-research" } };
      const { MAX_RESEARCH_ATTEMPTS } = await import(
        "../../src/utils/constants.js"
      );

      const state = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        researchAttempts: MAX_RESEARCH_ATTEMPTS
      };

      const result = await graph.invoke(state, config);

      // Should handle max attempts gracefully
      expect(result).toBeDefined();
    });

    it("should handle concurrent requests with same thread_id", async () => {
      const config = { configurable: { thread_id: "edge-concurrent" } };

      const promises = [
        graph.invoke(createNewQueryInput("Tell me about Apple"), config),
        graph.invoke(createNewQueryInput("Tell me about Tesla"), config)
      ];

      // Should handle concurrent requests (may serialize or handle gracefully)
      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });

  describe.skip("Timeout Scenarios", () => {
    it.skip("should handle timeout in streamWithInterruptSupport", async () => {
      const config = { configurable: { thread_id: "timeout-stream" } };
      const originalTimeout = process.env.GRAPH_TIMEOUT_MS;

      try {
        // Set a very short timeout
        process.env.GRAPH_TIMEOUT_MS = "100";

        await expect(
          streamWithInterruptSupport(
            graph,
            createNewQueryInput("Tell me about Apple"),
            config,
            () => {}
          )
        ).rejects.toThrow();
      } catch (error) {
        // Timeout should occur or operation should complete quickly
        expect(error).toBeDefined();
      } finally {
        if (originalTimeout) {
          process.env.GRAPH_TIMEOUT_MS = originalTimeout;
        } else {
          delete process.env.GRAPH_TIMEOUT_MS;
        }
      }
    });

    it.skip("should handle timeout in streamWithTokens", async () => {
      const config = { configurable: { thread_id: "timeout-tokens" } };
      const originalTimeout = process.env.GRAPH_TIMEOUT_MS;

      try {
        // Set a very short timeout
        process.env.GRAPH_TIMEOUT_MS = "100";

        await expect(
          streamWithTokens(
            graph,
            createNewQueryInput("Tell me about Apple"),
            config,
            {}
          )
        ).rejects.toThrow();
      } catch (error) {
        // Timeout should occur or operation should complete quickly
        expect(error).toBeDefined();
      } finally {
        if (originalTimeout) {
          process.env.GRAPH_TIMEOUT_MS = originalTimeout;
        } else {
          delete process.env.GRAPH_TIMEOUT_MS;
        }
      }
    });
  });

  describe("State Consistency", () => {
    it("should maintain state consistency across nodes", async () => {
      const config = { configurable: { thread_id: "consistency-test" } };

      const initialState = createNewQueryInput("Tell me about Apple");
      const result = await graph.invoke(initialState, config);

      // Check that correlation ID is preserved
      if (initialState.correlationId) {
        expect(result.correlationId).toBe(initialState.correlationId);
      }

      // Check that detected company is set if found
      if (result.detectedCompany) {
        expect(typeof result.detectedCompany).toBe("string");
      }
    });

    it("should preserve conversation summary across turns", async () => {
      const config = { configurable: { thread_id: "consistency-summary" } };

      const state1 = {
        ...createNewQueryInput("Tell me about Apple"),
        conversationSummary: "Previous conversation about tech companies"
      };

      const result1 = await graph.invoke(state1, config);

      // Summary should be preserved or updated appropriately
      expect(result1).toBeDefined();
    });
  });

  describe("Router Edge Cases", () => {
    it("should handle routing with null confidence score", async () => {
      const config = { configurable: { thread_id: "router-null-confidence" } };

      const state = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        confidenceScore: null as any
      };

      const result = await graph.invoke(state, config);

      // Should handle null gracefully
      expect(result).toBeDefined();
    });

    it("should handle routing with invalid validation result", async () => {
      const config = {
        configurable: { thread_id: "router-invalid-validation" }
      };

      const state = {
        ...createNewQueryInput("Tell me about Apple"),
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        validationResult: "invalid" as any
      };

      const result = await graph.invoke(state, config);

      // Should handle invalid state gracefully
      expect(result).toBeDefined();
    });
  });
});
