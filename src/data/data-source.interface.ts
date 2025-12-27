import type { ResearchFindings } from "../graph/state.js";

/**
 * Search context for research queries.
 * Provides additional context beyond just the company name.
 */
export interface SearchContext {
  /** The original user query for relevance */
  originalQuery: string;

  /** Feedback from validator if this is a retry */
  validationFeedback?: string | null;

  /** Current attempt number for logging */
  attemptNumber: number;

  /** Correlation ID for request tracing */
  correlationId?: string | null;
}

/**
 * Result from a data source search.
 * Includes findings plus metadata about the search.
 */
export interface SearchResult {
  /** The research findings (null if nothing found) */
  findings: ResearchFindings | null;

  /** Confidence score 0-10 */
  confidence: number;

  /** Source identifier for attribution */
  source: string;

  /** Raw response for debugging */
  rawResponse?: unknown;
}

/**
 * Abstract interface for research data sources.
 * Implementations must handle their own error cases.
 */
export interface ResearchDataSource {
  /**
   * Search for company information.
   *
   * @param company - Normalized company name to search
   * @param context - Additional search context
   * @returns Search result with findings and confidence
   * @throws DataSourceError if search fails unrecoverably
   */
  search(company: string, context: SearchContext): Promise<SearchResult>;

  /**
   * Get human-readable name of this data source.
   */
  getName(): string;

  /**
   * Check if this data source is available (e.g., API key configured).
   */
  isAvailable(): boolean;
}

/**
 * Error thrown when a data source fails.
 */
export class DataSourceError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly isRetryable: boolean,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}
