import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withErrorHandling } from "../../src/utils/error-wrapper.js";
import { createTestState } from "../helpers/test-factories.js";
import type { ResearchState } from "../../src/graph/state.js";
import { AgentNames } from "../../src/graph/routes.js";

describe("withErrorHandling", () => {
  const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore all console spies to prevent resource leaks
    consoleSpies.forEach((spy) => {
      if (spy && typeof spy.mockRestore === "function") {
        spy.mockRestore();
      }
    });
    consoleSpies.length = 0;
  });

  it("should pass through successful agent results", async () => {
    const mockAgent = vi.fn().mockResolvedValue({
      clarityStatus: "clear",
      detectedCompany: "Apple Inc."
    });

    const wrappedAgent = withErrorHandling(AgentNames.CLARITY, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result).toEqual({
      clarityStatus: "clear",
      detectedCompany: "Apple Inc."
    });
    expect(mockAgent).toHaveBeenCalledWith(state);
  });

  it("should catch errors and populate errorContext", async () => {
    const testError = new Error("LLM call failed");
    const mockAgent = vi.fn().mockRejectedValue(testError);

    const wrappedAgent = withErrorHandling(AgentNames.CLARITY, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext).toBeDefined();
    expect(result.errorContext?.failedNode).toBe(AgentNames.CLARITY);
    expect(result.errorContext?.errorMessage).toBe("LLM call failed");
    expect(result.errorContext?.originalError).toBe(testError);
    expect(result.currentAgent).toBe(AgentNames.CLARITY);
  });

  it("should detect retryable errors", async () => {
    const rateLimitError = new Error("Rate limit exceeded: 429");
    const mockAgent = vi.fn().mockRejectedValue(rateLimitError);

    const wrappedAgent = withErrorHandling(AgentNames.RESEARCH, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext?.isRetryable).toBe(true);
  });

  it("should detect non-retryable errors", async () => {
    const invalidInputError = new Error("Invalid input provided");
    const mockAgent = vi.fn().mockRejectedValue(invalidInputError);

    const wrappedAgent = withErrorHandling(AgentNames.RESEARCH, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext?.isRetryable).toBe(false);
  });

  it("should handle timeout errors as retryable", async () => {
    const timeoutError = new Error("Request timeout");
    const mockAgent = vi.fn().mockRejectedValue(timeoutError);

    const wrappedAgent = withErrorHandling(AgentNames.RESEARCH, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext?.isRetryable).toBe(true);
  });

  it("should handle network errors as retryable", async () => {
    const networkError = new Error("ECONNRESET");
    const mockAgent = vi.fn().mockRejectedValue(networkError);

    const wrappedAgent = withErrorHandling(AgentNames.RESEARCH, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext?.isRetryable).toBe(true);
  });

  it("should handle non-Error objects", async () => {
    const mockAgent = vi.fn().mockRejectedValue("string error");

    const wrappedAgent = withErrorHandling(AgentNames.CLARITY, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    expect(result.errorContext).toBeDefined();
    expect(result.errorContext?.errorMessage).toBe("string error");
    expect(result.errorContext?.isRetryable).toBe(false);
  });

  it("should preserve correlation ID in error context logging", async () => {
    const testError = new Error("Test error");
    const mockAgent = vi.fn().mockRejectedValue(testError);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleSpies.push(consoleSpy);

    const wrappedAgent = withErrorHandling(AgentNames.VALIDATOR, mockAgent);
    const state = createTestState({ correlationId: "test-correlation-123" });
    await wrappedAgent(state);

    // Check that correlation ID was included in log output
    expect(consoleSpy).toHaveBeenCalled();
    const logCalls = consoleSpy.mock.calls.flat().join(" ");
    expect(logCalls).toContain("test-correlation-123");
  });

  it("should work with all agent types", async () => {
    const agentNames = [
      AgentNames.CLARITY,
      AgentNames.RESEARCH,
      AgentNames.VALIDATOR,
      AgentNames.SYNTHESIS
    ] as const;

    for (const agentName of agentNames) {
      const mockAgent = vi.fn().mockRejectedValue(new Error("Test"));
      const wrappedAgent = withErrorHandling(agentName, mockAgent);
      const state = createTestState();
      const result = await wrappedAgent(state);

      expect(result.errorContext?.failedNode).toBe(agentName);
    }
  });

  it("should not modify state on success", async () => {
    const successResult: Partial<ResearchState> = {
      clarityStatus: "clear",
      detectedCompany: "Tesla Inc.",
      currentAgent: AgentNames.CLARITY
    };
    const mockAgent = vi.fn().mockResolvedValue(successResult);

    const wrappedAgent = withErrorHandling(AgentNames.CLARITY, mockAgent);
    const state = createTestState();
    const result = await wrappedAgent(state);

    // Should return exactly what the agent returned
    expect(result).toEqual(successResult);
    expect(result.errorContext).toBeUndefined();
  });
});
