import { describe, it, expect } from "vitest";
import { errorRecoveryAgent } from "../../src/agents/error-recovery.agent.js";
import { createTestState } from "../helpers/test-factories.js";
import { AgentNames } from "../../src/graph/routes.js";

// Create error-recovery-specific test state with defaults
function createErrorRecoveryTestState(
  overrides: Partial<
    Parameters<typeof createTestState>[0] & { errorContext?: unknown }
  > = {}
) {
  return createTestState({
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    ...overrides
  }) as ReturnType<typeof createTestState> & { errorContext?: unknown };
}

describe("errorRecoveryAgent", () => {
  it("should handle error from research node", async () => {
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: AgentNames.RESEARCH,
        errorMessage: "Data source unavailable",
        isRetryable: true
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("trouble finding information");
    expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
    expect(result.errorContext).toBeUndefined();
  });

  it("should handle error from clarity node", async () => {
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: AgentNames.CLARITY,
        errorMessage: "LLM call failed",
        isRetryable: false
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("trouble understanding");
    expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("should handle error from validator node with findings", async () => {
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: AgentNames.VALIDATOR,
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
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: AgentNames.SYNTHESIS,
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
    const state = createErrorRecoveryTestState({
      errorContext: null
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("unexpected error");
    expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("should handle unknown node error", async () => {
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: "unknown-node",
        errorMessage: "Unknown error",
        isRetryable: false
      }
    });

    const result = await errorRecoveryAgent(state);

    expect(result.finalSummary).toBeDefined();
    expect(result.finalSummary).toContain("error occurred");
    expect(result.currentAgent).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("should add message to state", async () => {
    const state = createErrorRecoveryTestState({
      errorContext: {
        failedNode: AgentNames.RESEARCH,
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
