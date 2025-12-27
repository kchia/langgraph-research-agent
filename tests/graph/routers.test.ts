import { describe, it, expect } from "vitest";
import {
  clarityRouter,
  researchRouter,
  validationRouter,
  checkForError
} from "../../src/graph/routers.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../../src/utils/constants.js";
import { createTestState } from "../helpers/test-factories.js";
import { DEFAULT_ROUTER_FINDINGS } from "../helpers/test-constants.js";
import { AgentNames } from "../../src/graph/routes.js";

describe("clarityRouter", () => {
  it("should return 'interrupt' when clarification is needed", () => {
    const state = createTestState({ clarityStatus: "needs_clarification" });
    expect(clarityRouter(state)).toBe(AgentNames.INTERRUPT);
  });

  it("should return 'research' when query is clear", () => {
    const state = createTestState({ clarityStatus: "clear" });
    expect(clarityRouter(state)).toBe(AgentNames.RESEARCH);
  });

  it("should return 'research' when status is pending", () => {
    const state = createTestState({ clarityStatus: "pending" });
    expect(clarityRouter(state)).toBe(AgentNames.RESEARCH);
  });
});

describe("researchRouter", () => {
  it("should return 'synthesis' when confidence meets threshold", () => {
    const state = createTestState({ confidenceScore: CONFIDENCE_THRESHOLD });
    expect(researchRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'synthesis' when confidence exceeds threshold", () => {
    const state = createTestState({
      confidenceScore: CONFIDENCE_THRESHOLD + 2
    });
    expect(researchRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'validator' when confidence below threshold", () => {
    const state = createTestState({
      confidenceScore: CONFIDENCE_THRESHOLD - 1,
      researchFindings: DEFAULT_ROUTER_FINDINGS
    });
    expect(researchRouter(state)).toBe(AgentNames.VALIDATOR);
  });

  it("should return 'validator' when confidence is zero", () => {
    const state = createTestState({
      confidenceScore: 0,
      researchFindings: DEFAULT_ROUTER_FINDINGS
    });
    expect(researchRouter(state)).toBe(AgentNames.VALIDATOR);
  });

  it("should return 'synthesis' when researchFindings is null (edge case)", () => {
    const state = createTestState({
      confidenceScore: 0,
      researchFindings: null
    });
    expect(researchRouter(state)).toBe(AgentNames.SYNTHESIS);
  });
});

describe("validationRouter", () => {
  it("should return 'research' when insufficient and can retry", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: 1
    });
    expect(validationRouter(state)).toBe(AgentNames.RESEARCH);
  });

  it("should return 'synthesis' when sufficient", () => {
    const state = createTestState({
      validationResult: "sufficient",
      researchAttempts: 1
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'synthesis' when max attempts reached", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'synthesis' when exceeds max attempts", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS + 1
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'research' at boundary (attempts = max - 1)", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS - 1
    });
    expect(validationRouter(state)).toBe(AgentNames.RESEARCH);
  });

  it("should return 'synthesis' when validationResult is pending", () => {
    const state = createTestState({
      validationResult: "pending",
      researchAttempts: 1
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'synthesis' when researchAttempts is invalid (NaN)", () => {
    const state = createTestState({
      validationResult: "sufficient",
      researchAttempts: NaN as unknown as number
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });

  it("should return 'synthesis' when researchAttempts is negative", () => {
    const state = createTestState({
      validationResult: "sufficient",
      researchAttempts: -1
    });
    expect(validationRouter(state)).toBe(AgentNames.SYNTHESIS);
  });
});

describe("router edge cases and validation", () => {
  it("researchRouter should handle invalid confidence score (NaN)", () => {
    const state = createTestState({
      confidenceScore: NaN,
      researchFindings: DEFAULT_ROUTER_FINDINGS
    });
    expect(researchRouter(state)).toBe(AgentNames.VALIDATOR);
  });

  it("researchRouter should handle invalid confidence score (undefined)", () => {
    const state = createTestState({
      confidenceScore: undefined as unknown as number,
      researchFindings: DEFAULT_ROUTER_FINDINGS
    });
    expect(researchRouter(state)).toBe(AgentNames.VALIDATOR);
  });
});

describe("error routing", () => {
  it("checkForError should return error-recovery when errorContext is set", () => {
    const state = createTestState({
      errorContext: {
        failedNode: AgentNames.RESEARCH,
        errorMessage: "Test error",
        isRetryable: false
      }
    });
    expect(checkForError(state)).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("checkForError should return null when errorContext is null", () => {
    const state = createTestState({
      errorContext: null
    });
    expect(checkForError(state)).toBeNull();
  });

  it("clarityRouter should route to error-recovery when errorContext is set", () => {
    const state = createTestState({
      clarityStatus: "clear",
      errorContext: {
        failedNode: AgentNames.CLARITY,
        errorMessage: "Test error",
        isRetryable: false
      }
    });
    expect(clarityRouter(state)).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("researchRouter should route to error-recovery when errorContext is set", () => {
    const state = createTestState({
      confidenceScore: 8,
      researchFindings: DEFAULT_ROUTER_FINDINGS,
      errorContext: {
        failedNode: AgentNames.RESEARCH,
        errorMessage: "Test error",
        isRetryable: false
      }
    });
    expect(researchRouter(state)).toBe(AgentNames.ERROR_RECOVERY);
  });

  it("validationRouter should route to error-recovery when errorContext is set", () => {
    const state = createTestState({
      validationResult: "sufficient",
      researchAttempts: 1,
      errorContext: {
        failedNode: AgentNames.VALIDATOR,
        errorMessage: "Test error",
        isRetryable: false
      }
    });
    expect(validationRouter(state)).toBe(AgentNames.ERROR_RECOVERY);
  });
});
