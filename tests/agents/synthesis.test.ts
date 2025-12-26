import { describe, it, expect, vi } from "vitest";
import { createSynthesisAgent } from "../../src/agents/synthesis.agent.js";
import type { ResearchState, ResearchFindings } from "../../src/graph/state.js";
import { MAX_RESEARCH_ATTEMPTS } from "../../src/utils/constants.js";

function createMockLLM(responseContent: string) {
  return {
    invoke: vi.fn().mockResolvedValue({ content: responseContent })
  } as any;
}

const completeFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Launched Vision Pro",
  stockInfo: "AAPL at $195",
  keyDevelopments: "AI integration",
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
    validationResult: "sufficient",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "synthesis",
    ...overrides
  };
}

describe("synthesisAgent", () => {
  describe("high confidence", () => {
    it("should generate summary without disclaimer", async () => {
      const mockLLM = createMockLLM("Apple is doing great!");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ confidenceScore: 9 });

      const result = await agent(state);

      expect(result.finalSummary).toBe("Apple is doing great!");
      expect(result.finalSummary).not.toContain("Note");
      expect(result.messages).toHaveLength(1);
    });
  });

  describe("low confidence", () => {
    it("should add warning prefix for low confidence", async () => {
      const mockLLM = createMockLLM("Limited Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ confidenceScore: 3 });

      const result = await agent(state);

      expect(result.finalSummary).toContain("Note");
      expect(result.finalSummary).toContain("limited");
    });
  });

  describe("max attempts reached", () => {
    it("should indicate verification issues when max attempts hit", async () => {
      const mockLLM = createMockLLM("Partial Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({
        confidenceScore: 6,
        validationResult: "insufficient",
        researchAttempts: MAX_RESEARCH_ATTEMPTS
      });

      const result = await agent(state);

      expect(result.finalSummary).toContain("couldn't verify");
    });
  });

  describe("no data", () => {
    it("should generate apologetic response for null findings", async () => {
      const mockLLM = createMockLLM("Should not see this");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ researchFindings: null });

      const result = await agent(state);

      expect(result.finalSummary).toContain("couldn't find");
      expect(result.finalSummary).toContain("different spelling");
    });
  });

  describe("LLM failure fallback", () => {
    it("should generate template response on LLM error", async () => {
      const failingLLM = {
        invoke: vi.fn().mockRejectedValue(new Error("LLM down"))
      } as any;

      const agent = createSynthesisAgent(failingLLM);
      const state = createTestState();

      const result = await agent(state);

      expect(result.finalSummary).toContain("Apple Inc.");
      expect(result.finalSummary).toContain("Vision Pro"); // From findings
    });
  });
});
