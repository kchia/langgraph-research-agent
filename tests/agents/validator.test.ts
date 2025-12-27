import { describe, it, expect, vi } from "vitest";
import { createValidatorAgent } from "../../src/agents/validator.agent.js";
import {
  createTestState,
  createMockLLMWithStructuredOutput,
  type ValidatorLLMResponse
} from "../helpers/test-factories.js";
import {
  COMPLETE_FINDINGS,
  PARTIAL_FINDINGS,
  createLongFindings
} from "../helpers/test-constants.js";
import { AgentNames } from "../../src/graph/routes.js";

// Create validator-specific test state with defaults
function createValidatorTestState(
  overrides: Partial<Parameters<typeof createTestState>[0]> = {}
) {
  return createTestState({
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    researchFindings: COMPLETE_FINDINGS,
    confidenceScore: 8,
    researchAttempts: 1,
    currentAgent: AgentNames.VALIDATOR,
    ...overrides
  });
}

describe("validatorAgent", () => {
  describe("sufficient findings", () => {
    it("should approve complete findings", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ValidatorLLMResponse>({
        is_sufficient: true,
        feedback: null,
        reasoning: "All fields populated"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createValidatorTestState();

      const result = await agent(state);

      expect(result.validationResult).toBe("sufficient");
      expect(result.validationFeedback).toBeNull();
    });
  });

  describe("insufficient findings", () => {
    it("should reject null findings", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ValidatorLLMResponse>({
        is_sufficient: false,
        feedback: "No data",
        reasoning: "Empty"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createValidatorTestState({ researchFindings: null });

      const result = await agent(state);

      expect(result.validationResult).toBe("insufficient");
      expect(result.validationFeedback).toContain("No research data");
    });

    it("should provide specific feedback for missing fields", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ValidatorLLMResponse>({
        is_sufficient: false,
        feedback: "Missing financial data and key developments",
        reasoning: "Incomplete"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createValidatorTestState({
        researchFindings: PARTIAL_FINDINGS
      });

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
      const state = createValidatorTestState({
        researchFindings: COMPLETE_FINDINGS
      });

      const result = await agent(state);

      // Should still work via fallback
      expect(result.validationResult).toBe("sufficient");
    });
  });

  describe("model compatibility", () => {
    it("should throw error for model without structured output support", () => {
      const unsupportedModel = {
        invoke: vi.fn()
      } as any;

      expect(() => createValidatorAgent(unsupportedModel)).toThrow(
        "does not support structured output"
      );
    });

    it("should work with model that has withStructuredOutput", () => {
      const supportedModel =
        createMockLLMWithStructuredOutput<ValidatorLLMResponse>({
          is_sufficient: true,
          feedback: null,
          reasoning: "Test"
        });

      expect(() => createValidatorAgent(supportedModel)).not.toThrow();
    });
  });

  describe("token budget", () => {
    it("should truncate findings if they exceed token budget", async () => {
      const invokeSpy = vi.fn().mockResolvedValue({
        is_sufficient: true,
        feedback: null,
        reasoning: "All good"
      });

      const mockLLM = {
        withStructuredOutput: vi.fn().mockReturnValue({
          invoke: invokeSpy
        })
      } as any;

      const agent = createValidatorAgent(mockLLM);
      const state = createValidatorTestState({
        researchFindings: createLongFindings()
      });

      const result = await agent(state);

      expect(result.validationResult).toBe("sufficient");
      expect(invokeSpy).toHaveBeenCalled();
      const callArgs = invokeSpy.mock.calls[0][0];
      expect(callArgs).toBeDefined();
    });
  });
});
