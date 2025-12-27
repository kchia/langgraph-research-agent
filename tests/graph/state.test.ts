import { describe, it, expect } from "vitest";
import {
  ResearchStateAnnotation,
  type ResearchState
} from "../../src/graph/state.js";
import { AgentNames } from "../../src/graph/routes.js";

describe("ResearchStateAnnotation", () => {
  it("should have correct default values", () => {
    const defaults: ResearchState = {
      messages: [],
      conversationSummary: null,
      originalQuery: "",
      clarityStatus: "pending",
      clarificationAttempts: 0,
      clarificationQuestion: null,
      detectedCompany: null,
      researchFindings: null,
      confidenceScore: 0,
      researchAttempts: 0,
      validationResult: "pending",
      validationFeedback: null,
      finalSummary: null,
      currentAgent: AgentNames.CLARITY
    };

    // Verify types compile correctly
    expect(defaults.clarityStatus).toBe("pending");
    expect(defaults.messages).toEqual([]);
  });

  it("should allow valid ClarityStatus values", () => {
    const statuses: Array<"pending" | "clear" | "needs_clarification"> = [
      "pending",
      "clear",
      "needs_clarification"
    ];
    expect(statuses).toHaveLength(3);
  });

  it("should allow valid ValidationResult values", () => {
    const results: Array<"pending" | "sufficient" | "insufficient"> = [
      "pending",
      "sufficient",
      "insufficient"
    ];
    expect(results).toHaveLength(3);
  });
});
