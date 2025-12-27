import type { ResearchState } from "../graph/state.js";
import type {
  ResearchDataSource,
  SearchContext
} from "../sources/data-source.interface.js";
import { DataSourceError } from "../sources/data-source.interface.js";
import { createDataSource } from "../sources/index.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { AgentNames } from "../graph/routes.js";

/**
 * Factory function to create Research Agent with injectable data source.
 */
export function createResearchAgent(dataSource?: ResearchDataSource) {
  const source = dataSource ?? createDataSource();

  return async function researchAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const logger = createLoggerWithCorrelationId(
      "research-agent",
      state.correlationId
    );
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
        currentAgent: AgentNames.RESEARCH
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
        currentAgent: AgentNames.RESEARCH
      };
    } catch (error) {
      if (error instanceof DataSourceError) {
        logger.error("Data source error", {
          source: error.source,
          retryable: error.isRetryable,
          message: error.message
        });
      } else {
        logger.error("Research agent unexpected error", {
          error: error instanceof Error ? error.message : String(error),
          company: state.detectedCompany,
          attempt: attemptNumber
        });
      }

      // Graceful degradation: return null findings, don't crash
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: AgentNames.RESEARCH
      };
    }
  };
}

// Default export for graph
export const researchAgent = createResearchAgent();
