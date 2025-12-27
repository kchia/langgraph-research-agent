import { vi } from "vitest";
import type { ResearchState, ResearchFindings } from "../../src/graph/state.js";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "../../src/data/data-source.interface.js";

/**
 * Create a test state with sensible defaults.
 * Override any field by passing it in the overrides object.
 */
export function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    clarificationResponse: null,
    detectedCompany: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "clarity",
    errorContext: null,
    correlationId: null,
    ...overrides
  };
}

/**
 * Create a mock LLM with structured output support.
 * Used by clarity and validator agents.
 */
export function createMockLLMWithStructuredOutput<T>(response: T) {
  const invokeMock = vi.fn().mockResolvedValue(response);
  return {
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: invokeMock
    }),
    _invokeMock: invokeMock
  } as unknown as ReturnType<typeof createMockLLMWithStructuredOutput<T>> & {
    _invokeMock: ReturnType<typeof vi.fn>;
  };
}

/**
 * Create a mock LLM with direct invoke support.
 * Used by synthesis agent.
 */
export function createMockLLMSimple(responseContent: string) {
  const invokeMock = vi.fn().mockResolvedValue({ content: responseContent });
  return {
    invoke: invokeMock,
    _invokeMock: invokeMock
  } as unknown as { invoke: ReturnType<typeof vi.fn>; _invokeMock: ReturnType<typeof vi.fn> };
}

/**
 * Create a tracking mock data source for research agent tests.
 * Tracks all search contexts passed to it.
 */
export function createTrackingDataSource(
  results: SearchResult[]
): ResearchDataSource & { contexts: SearchContext[] } {
  let callIndex = 0;
  const contexts: SearchContext[] = [];

  return {
    contexts,
    search: vi.fn(async (_company: string, context: SearchContext) => {
      contexts.push(context);
      return results[callIndex++] ?? results[results.length - 1];
    }),
    getName: () => "Tracking Mock",
    isAvailable: () => true
  };
}

/**
 * Create a failing mock LLM that rejects with an error.
 * Used for testing error handling paths.
 */
export function createFailingMockLLM(error: Error = new Error("LLM failed")) {
  return {
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockRejectedValue(error)
    }),
    invoke: vi.fn().mockRejectedValue(error)
  };
}

/**
 * Create clarity agent LLM response structure.
 */
export interface ClarityLLMResponse {
  is_clear: boolean;
  detected_company: string | null;
  clarification_needed: string | null;
  reasoning: string;
}

/**
 * Create validator agent LLM response structure.
 */
export interface ValidatorLLMResponse {
  is_sufficient: boolean;
  feedback: string | null;
  reasoning: string;
}
