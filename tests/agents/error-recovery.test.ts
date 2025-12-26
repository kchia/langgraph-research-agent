import { describe, it, expect } from "vitest";
import { errorRecoveryAgent } from "../../src/agents/error-recovery.agent.js";
import type { ResearchState } from "../../src/graph/state.js";

function createTestState(
  overrides: Partial<ResearchState & { errorContext?: unknown }> = {}
): ResearchState & { errorContext?: unknown } {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "clear",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    clarificationResponse: null,
    detectedCompany: "Apple Inc.",
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "clarity",
    errorContext: null,
    ...overrides
  };
}

describe("errorRecoveryAgent", () => {
  it("should handle error from research node", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "research",
        errorMessage: "Data source unavailable",
        isRetryable: true
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("trouble finding information");
    expect(result.currentAgent).toBe("error-recovery");
    expect(result.errorContext).toBeUndefined(); // Should be cleared
  });

  it("should handle error from clarity node", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "clarity",
        errorMessage: "LLM call failed",
        isRetryable: false
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("trouble understanding");
    expect(result.currentAgent).toBe("error-recovery");
  });

  it("should handle error from validator node with findings", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "validator",
        errorMessage: "Validation failed",
        isRetryable: false
      },
      researchFindings: {
        company: "Apple Inc.",
        recentNews: "New product launch",
        stockInfo: "$195",
        keyDevelopments: "AI integration",
        sources: ["Test"],
        rawData: {}
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("couldn't verify");
    expect(result.finalSummary).toContain("Apple Inc.");
    expect(result.finalSummary).toContain("New product launch");
  });

  it("should handle error from synthesis node with findings", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "synthesis",
        errorMessage: "LLM generation failed",
        isRetryable: false
      },
      researchFindings: {
        company: "Tesla Inc.",
        recentNews: "Stock update",
        stockInfo: "$250",
        keyDevelopments: "New factory",
        sources: ["Test"],
        rawData: {}
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("trouble generating");
    expect(result.finalSummary).toContain("Tesla Inc.");
  });

  it("should handle error without error context", async () => {
    const state = createTestState({
      errorContext: null
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("unexpected error");
    expect(result.currentAgent).toBe("error-recovery");
  });

  it("should handle unknown node error", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "unknown-node",
        errorMessage: "Unknown error",
        isRetryable: false
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("error occurred");
    expect(result.currentAgent).toBe("error-recovery");
  });

  it("should add message to state", async () => {
    const state = createTestState({
      errorContext: {
        failedNode: "research",
        errorMessage: "Test error",
        isRetryable: false
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBeGreaterThan(0);
    expect(result.messages?.[0]._getType()).toBe("ai");
  });
});
