import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Research Agent
 * Returns mock findings for testing graph structure.
 * Will be replaced with real implementation in Commit 9.
 */
export async function researchAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    researchFindings: {
      company: state.detectedCompany ?? "Unknown",
      recentNews: "Stub news data",
      stockInfo: "Stub stock data",
      keyDevelopments: "Stub developments",
      sources: ["Stub Source"],
      rawData: {}
    },
    confidenceScore: 8,
    researchAttempts: state.researchAttempts + 1,
    currentAgent: "research"
  };
}
