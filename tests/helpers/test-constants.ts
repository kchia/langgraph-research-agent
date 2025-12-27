import type { ResearchFindings } from "../../src/graph/state.js";

/**
 * Complete research findings with all fields populated.
 * Use for tests that need valid, complete data.
 */
export const COMPLETE_FINDINGS: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Launched Vision Pro headset",
  stockInfo: "AAPL trading at $195",
  keyDevelopments: "AI integration across products",
  sources: ["Test Source"],
  rawData: {}
};

/**
 * Partial research findings with some fields missing.
 * Use for tests that need incomplete data.
 */
export const PARTIAL_FINDINGS: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Some news",
  stockInfo: null,
  keyDevelopments: null,
  sources: ["Test"],
  rawData: {}
};

/**
 * Default research findings for router tests.
 */
export const DEFAULT_ROUTER_FINDINGS = {
  company: "Test Company",
  sources: [],
  keyFacts: [],
  timestamp: new Date().toISOString()
};

/**
 * Length for generating very long text in token budget tests.
 */
export const LONG_TEXT_LENGTH = 100000;

/**
 * Generate long text for token budget testing.
 */
export function generateLongText(char: string = "A"): string {
  return char.repeat(LONG_TEXT_LENGTH);
}

/**
 * Create findings with very long text fields for token budget testing.
 */
export function createLongFindings(): ResearchFindings {
  return {
    company: "Apple Inc.",
    recentNews: generateLongText("A"),
    stockInfo: generateLongText("B"),
    keyDevelopments: generateLongText("C"),
    sources: ["Test"],
    rawData: {}
  };
}
