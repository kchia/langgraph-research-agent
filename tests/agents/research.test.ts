import { describe, it, expect, vi } from "vitest";
import { createResearchAgent } from "../../src/agents/research.agent.js";
import type { ResearchDataSource } from "../../src/sources/data-source.interface.js";
import { DataSourceError } from "../../src/sources/data-source.interface.js";
import {
  createTestState,
  createTrackingDataSource
} from "../helpers/test-factories.js";
import { AgentNames } from "../../src/graph/routes.js";

// Create research-specific test state with defaults
function createResearchTestState(
  overrides: Partial<Parameters<typeof createTestState>[0]> = {}
) {
  return createTestState({
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    currentAgent: AgentNames.RESEARCH,
    ...overrides
  });
}

describe("researchAgent", () => {
  describe("successful search", () => {
    it("should return findings and confidence", async () => {
      const mockSource = createTrackingDataSource([
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
      const state = createResearchTestState();

      const result = await agent(state);

      expect(result.researchFindings?.company).toBe("Apple Inc.");
      expect(result.confidenceScore).toBe(8);
      expect(result.researchAttempts).toBe(1);
    });

    it("should increment attempt counter", async () => {
      const mockSource = createTrackingDataSource([
        {
          findings: null,
          confidence: 0,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createResearchTestState({ researchAttempts: 2 });

      const result = await agent(state);

      expect(result.researchAttempts).toBe(3);
    });
  });

  describe("validation feedback", () => {
    it("should pass validation feedback to data source", async () => {
      const mockSource = createTrackingDataSource([
        {
          findings: null,
          confidence: 5,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createResearchTestState({
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
      const mockSource = createTrackingDataSource([]);

      const agent = createResearchAgent(mockSource);
      const state = createResearchTestState({ detectedCompany: null });

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
      const state = createResearchTestState();

      const result = await agent(state);

      expect(result.researchFindings).toBeNull();
      expect(result.confidenceScore).toBe(0);
      expect(result.researchAttempts).toBe(1);
    });
  });
});
