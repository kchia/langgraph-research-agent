import type { ResearchState } from "../graph/state.js";
import type {
  ResearchDataSource,
  SearchContext
} from "../data/data-source.interface.js";
import { DataSourceError } from "../data/data-source.interface.js";
import { createDataSource } from "../data/index.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("research-agent");

/**
 * Factory function to create Research Agent with injectable data source.
 */
export function createResearchAgent(dataSource?: ResearchDataSource) {
  const source = dataSource ?? createDataSource();

  return async function researchAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const attemptNumber = state.researchAttempts + 1;

    logger.info("Research started", {
      company: state.detectedCompany,
      attempt: attemptNumber,
      dataSource: source.getName(),
      hasFeedback: !!state.validationFeedback
    });

    // Early exit if no company
    if (!state.detectedCompany) {
      logger.warn("No company detected, returning empty findings");
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    }

    const searchContext: SearchContext = {
      originalQuery: state.originalQuery,
      validationFeedback: state.validationFeedback,
      attemptNumber
    };

    try {
      const result = await source.search(state.detectedCompany, searchContext);

      logger.info("Research completed", {
        company: state.detectedCompany,
        confidence: result.confidence,
        hasFindings: !!result.findings,
        source: result.source
      });

      return {
        researchFindings: result.findings,
        confidenceScore: result.confidence,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    } catch (error) {
      if (error instanceof DataSourceError) {
        logger.error("Data source error", {
          source: error.source,
          retryable: error.isRetryable,
          message: error.message
        });
      } else {
        logger.error("Unexpected error", { error: String(error) });
      }

      // Graceful degradation: return null findings, don't crash
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    }
  };
}

// Default export for graph
export const researchAgent = createResearchAgent();
