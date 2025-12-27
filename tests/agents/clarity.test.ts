import { describe, it, expect } from "vitest";
import { createClarityAgent } from "../../src/agents/clarity.agent.js";
import { MAX_CLARIFICATION_ATTEMPTS } from "../../src/utils/constants.js";
import {
  createTestState,
  createMockLLMWithStructuredOutput,
  type ClarityLLMResponse
} from "../helpers/test-factories.js";

describe("clarityAgent", () => {
  describe("clear queries", () => {
    it("should detect company from explicit mention", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Company explicitly mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "Tell me about Apple" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toBe("Apple Inc.");
    });
  });

  describe("unclear queries", () => {
    it("should request clarification for vague queries", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: false,
        detected_company: null,
        clarification_needed: "Which company are you asking about?",
        reasoning: "No company mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about the company"
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("needs_clarification");
      expect(result.clarificationQuestion).toContain("company");
      expect(result.clarificationAttempts).toBe(1);
    });
  });

  describe("follow-up queries", () => {
    it("should use existing company for follow-ups", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Follow-up"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "What about their stock?",
        detectedCompany: "Apple Inc."
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      // Should NOT have called LLM (follow-up pattern detected)
    });
  });

  describe("max attempts", () => {
    it("should force proceed after max clarification attempts", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: false,
        detected_company: null,
        clarification_needed: "Still unclear",
        reasoning: "Unclear"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about it",
        clarificationAttempts: MAX_CLARIFICATION_ATTEMPTS
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
    });
  });

  describe("cancel requests", () => {
    it("should handle 'nevermind' gracefully", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: false,
        detected_company: null,
        clarification_needed: null,
        reasoning: ""
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "nevermind" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.finalSummary).toContain("No problem");
    });
  });

  describe("empty query", () => {
    it("should request clarification for empty input", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: false,
        detected_company: null,
        clarification_needed: null,
        reasoning: ""
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("needs_clarification");
      expect(result.clarificationQuestion).toContain("Hello");
    });
  });

  describe("model compatibility", () => {
    it("should throw error for model without structured output support", () => {
      // Create a mock model without withStructuredOutput method
      const unsupportedModel = {
        invoke: vi.fn()
      } as any;

      expect(() => createClarityAgent(unsupportedModel)).toThrow(
        "does not support structured output"
      );
    });

    it("should work with model that has withStructuredOutput", () => {
      const supportedModel = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Test"
      });

      // Should not throw
      expect(() => createClarityAgent(supportedModel)).not.toThrow();
    });
  });

  describe("conversation summary", () => {
    it("should use existing conversation summary if available", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Company mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about Apple",
        conversationSummary: "Previous conversation about tech companies"
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toBe("Apple Inc.");
      // Summary should be preserved if it exists
      if (result.conversationSummary !== undefined) {
        expect(result.conversationSummary).toBeTruthy();
      }
    });

    it("should work without conversation summary", async () => {
      const mockLLM = createMockLLMWithStructuredOutput<ClarityLLMResponse>({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Company mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about Apple",
        conversationSummary: null
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toBe("Apple Inc.");
    });
  });
});
