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

    // Simulate improvement on retry - first attempt returns partial data
    // This ensures the validation loop is exercised in mock mode
    const isRetry = context.attemptNumber > 1;
    const hasFeedback = !!context.validationFeedback;

    let findings: ResearchFindings;
    let confidence: number;

    if (isRetry && hasFeedback) {
      // On retry with feedback: return complete data with high confidence
      findings = {
        ...data,
        sources: [this.getName()],
        rawData: {
          searchedName: company,
          normalizedTo: normalizedName,
          attemptNumber: context.attemptNumber,
          hadFeedback: true,
          usedFeedback: context.validationFeedback
        }
      };
      confidence = this.calculateConfidence(findings);
    } else {
      // First attempt: return partial data with lower confidence
      // This triggers validation and demonstrates the retry loop
      findings = {
        company: data.company,
        recentNews: data.recentNews,
        stockInfo: null, // Omit on first attempt
        keyDevelopments: null, // Omit on first attempt
        sources: [this.getName()],
        rawData: {
          searchedName: company,
          normalizedTo: normalizedName,
          attemptNumber: context.attemptNumber,
          hadFeedback: false,
          partialData: true
        }
      };
      confidence = 4; // Below CONFIDENCE_THRESHOLD (6), triggers validation
    }

    return {
      findings,
      confidence,
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
