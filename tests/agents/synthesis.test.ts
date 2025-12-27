import { describe, it, expect, vi } from "vitest";
import { createSynthesisAgent } from "../../src/agents/synthesis.agent.js";
import { MAX_RESEARCH_ATTEMPTS } from "../../src/utils/constants.js";
import {
  createTestState,
  createMockLLMSimple
} from "../helpers/test-factories.js";
import {
  COMPLETE_FINDINGS,
  createLongFindings
} from "../helpers/test-constants.js";
import { AgentNames } from "../../src/graph/routes.js";

// Create synthesis-specific test state with defaults
function createSynthesisTestState(
  overrides: Partial<Parameters<typeof createTestState>[0]> = {}
) {
  return createTestState({
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    researchFindings: COMPLETE_FINDINGS,
    confidenceScore: 8,
    researchAttempts: 1,
    validationResult: "sufficient",
    currentAgent: AgentNames.SYNTHESIS,
    ...overrides
  });
}

describe("synthesisAgent", () => {
  describe("high confidence", () => {
    it("should generate summary without disclaimer", async () => {
      const mockLLM = createMockLLMSimple("Apple is doing great!");

      const agent = createSynthesisAgent(mockLLM);
      const state = createSynthesisTestState({ confidenceScore: 9 });

      const result = await agent(state);

      expect(result.finalSummary).toBe("Apple is doing great!");
      expect(result.finalSummary).not.toContain("Note");
      expect(result.messages).toHaveLength(1);
    });
  });

  describe("low confidence", () => {
    it("should add warning prefix for low confidence", async () => {
      const mockLLM = createMockLLMSimple("Limited Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createSynthesisTestState({ confidenceScore: 3 });

      const result = await agent(state);

      expect(result.finalSummary).toContain("Note");
      expect(result.finalSummary).toContain("limited");
    });
  });

  describe("max attempts reached", () => {
    it("should indicate verification issues when max attempts hit", async () => {
      const mockLLM = createMockLLMSimple("Partial Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createSynthesisTestState({
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
      const mockLLM = createMockLLMSimple("Should not see this");

      const agent = createSynthesisAgent(mockLLM);
      const state = createSynthesisTestState({ researchFindings: null });

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
      const state = createSynthesisTestState();

      const result = await agent(state);

      expect(result.finalSummary).toContain("Apple Inc.");
      expect(result.finalSummary).toContain("Launched Vision Pro"); // From COMPLETE_FINDINGS
    });
  });

  describe("token budget", () => {
    it("should truncate findings if they exceed token budget", async () => {
      const invokeSpy = vi.fn().mockResolvedValue({
        content: "Summary of findings"
      });

      const mockLLM = {
        invoke: invokeSpy
      } as any;

      const agent = createSynthesisAgent(mockLLM);
      const state = createSynthesisTestState({
        researchFindings: createLongFindings()
      });

      const result = await agent(state);

      expect(result.finalSummary).toBe("Summary of findings");
      expect(invokeSpy).toHaveBeenCalled();
    });
  });
});
