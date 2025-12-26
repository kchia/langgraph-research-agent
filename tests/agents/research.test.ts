import { describe, it, expect, vi } from "vitest";
import { createResearchAgent } from "../../src/agents/research.agent.js";
import type { ResearchState } from "../../src/graph/state.js";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "../../src/data/data-source.interface.js";
import { DataSourceError } from "../../src/data/data-source.interface.js";

// Tracking mock data source
function createTrackingMock(
  results: SearchResult[]
): ResearchDataSource & { contexts: SearchContext[] } {
  let callIndex = 0;
  const contexts: SearchContext[] = [];

  return {
    contexts,
    search: vi.fn(async (company: string, context: SearchContext) => {
      contexts.push(context);
      return results[callIndex++] ?? results[results.length - 1];
    }),
    getName: () => "Tracking Mock",
    isAvailable: () => true
  };
}

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
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "research",
    ...overrides
  };
}

describe("researchAgent", () => {
  describe("successful search", () => {
    it("should return findings and confidence", async () => {
      const mockSource = createTrackingMock([
        {
          findings: {
            company: "Apple Inc.",
            recentNews: "News",
            stockInfo: "Stock",
            keyDevelopments: "Dev",
            sources: ["Test"],
            rawData: {}
          },
          confidence: 8,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState();

      const result = await agent(state);

      expect(result.researchFindings?.company).toBe("Apple Inc.");
      expect(result.confidenceScore).toBe(8);
      expect(result.researchAttempts).toBe(1);
    });

    it("should increment attempt counter", async () => {
      const mockSource = createTrackingMock([
        {
          findings: null,
          confidence: 0,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({ researchAttempts: 2 });

      const result = await agent(state);

      expect(result.researchAttempts).toBe(3);
    });
  });

  describe("validation feedback", () => {
    it("should pass validation feedback to data source", async () => {
      const mockSource = createTrackingMock([
        {
          findings: null,
          confidence: 5,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({
        validationFeedback: "Missing financial data",
        researchAttempts: 1
      });

      await agent(state);

      expect(mockSource.contexts[0].validationFeedback).toBe(
        "Missing financial data"
      );
      expect(mockSource.contexts[0].attemptNumber).toBe(2);
    });
  });

  describe("no company", () => {
    it("should return null findings when no company detected", async () => {
      const mockSource = createTrackingMock([]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({ detectedCompany: null });

      const result = await agent(state);

      expect(result.researchFindings).toBeNull();
      expect(result.confidenceScore).toBe(0);
      expect(mockSource.search).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle DataSourceError gracefully", async () => {
      const mockSource: ResearchDataSource = {
        search: vi
          .fn()
          .mockRejectedValue(new DataSourceError("API error", "Test", true)),
        getName: () => "Failing Mock",
        isAvailable: () => true
      };

      const agent = createResearchAgent(mockSource);
      const state = createTestState();

      const result = await agent(state);

      expect(result.researchFindings).toBeNull();
      expect(result.confidenceScore).toBe(0);
      expect(result.researchAttempts).toBe(1);
    });
  });
});
