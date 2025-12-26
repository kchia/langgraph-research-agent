import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
import type { ResearchFindings } from "../graph/state.js";
import { MOCK_RESEARCH_DATA } from "./mock-data.js";

/**
 * Mock data source for development and testing.
 * Provides deterministic, fast responses without API calls.
 */
export class MockDataSource implements ResearchDataSource {
  getName(): string {
    return "Mock Data Source";
  }

  isAvailable(): boolean {
    return true; // Always available
  }

  async search(company: string, context: SearchContext): Promise<SearchResult> {
    const normalizedName = this.normalizeCompanyName(company);
    const data = MOCK_RESEARCH_DATA[normalizedName];

    if (!data) {
      return {
        findings: null,
        confidence: 0,
        source: this.getName(),
        rawResponse: {
          searched: company,
          normalizedTo: normalizedName,
          found: false
        }
      };
    }

    const findings: ResearchFindings = {
      ...data,
      sources: [this.getName()],
      rawData: {
        searchedName: company,
        normalizedTo: normalizedName,
        attemptNumber: context.attemptNumber,
        hadFeedback: !!context.validationFeedback
      }
    };

    return {
      findings,
      confidence: this.calculateConfidence(findings),
      source: this.getName(),
      rawResponse: data
    };
  }

  private normalizeCompanyName(company: string): string {
    return company
      .toLowerCase()
      .replace(/[,.]|inc|corp|corporation|ltd|llc|co\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateConfidence(findings: ResearchFindings): number {
    let score = 0;
    if (findings.recentNews) score += 3;
    if (findings.stockInfo) score += 3;
    if (findings.keyDevelopments) score += 3;
    if (findings.company) score += 1;
    return score; // Max 10
  }
}
