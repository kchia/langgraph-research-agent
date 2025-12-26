import { describe, it, expect, vi } from "vitest";
import { createValidatorAgent } from "../../src/agents/validator.agent.js";
import type { ResearchState, ResearchFindings } from "../../src/graph/state.js";

function createMockLLM(response: {
  is_sufficient: boolean;
  feedback: string | null;
  reasoning: string;
}) {
  return {
    withStructuredOutput: () => ({
      invoke: vi.fn().mockResolvedValue(response)
    })
  } as any;
}

const completeFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Launched new products",
  stockInfo: "Trading at $195",
  keyDevelopments: "AI integration",
  sources: ["Test Source"],
  rawData: {}
};

const partialFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Some news",
  stockInfo: null,
  keyDevelopments: null,
  sources: ["Test"],
  rawData: {}
};

function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "clear",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: "Apple Inc.",
    researchFindings: completeFindings,
    confidenceScore: 8,
    researchAttempts: 1,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "validator",
    ...overrides
  };
}

describe("validatorAgent", () => {
  describe("sufficient findings", () => {
    it("should approve complete findings", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: true,
        feedback: null,
        reasoning: "All fields populated"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState();

      const result = await agent(state);

      expect(result.validationResult).toBe("sufficient");
      expect(result.validationFeedback).toBeNull();
    });
  });

  describe("insufficient findings", () => {
    it("should reject null findings", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: false,
        feedback: "No data",
        reasoning: "Empty"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState({ researchFindings: null });

      const result = await agent(state);

      expect(result.validationResult).toBe("insufficient");
      expect(result.validationFeedback).toContain("No research data");
    });

    it("should provide specific feedback for missing fields", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: false,
        feedback: "Missing financial data and key developments",
        reasoning: "Incomplete"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState({ researchFindings: partialFindings });

      const result = await agent(state);

      expect(result.validationResult).toBe("insufficient");
      expect(result.validationFeedback).toContain("Missing");
    });
  });

  describe("LLM failure fallback", () => {
    it("should use rule-based validation on LLM error", async () => {
      const failingLLM = {
        withStructuredOutput: () => ({
          invoke: vi.fn().mockRejectedValue(new Error("LLM failed"))
        })
      } as any;

      const agent = createValidatorAgent(failingLLM);
      const state = createTestState({ researchFindings: completeFindings });

      const result = await agent(state);

      // Should still work via fallback
      expect(result.validationResult).toBe("sufficient");
    });
  });
});
