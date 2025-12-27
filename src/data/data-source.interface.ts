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
 * Options for creating a DataSourceError.
 */
export interface DataSourceErrorOptions {
  /** The original error that caused this failure */
  originalError?: Error;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Node.js or system error code (e.g., ECONNRESET) */
  errorCode?: string;
}

/**
 * Error thrown when a data source fails.
 * Includes structured properties for reliable error detection.
 */
export class DataSourceError extends Error {
  readonly source: string;
  readonly isRetryable: boolean;
  readonly originalError?: Error;
  /** HTTP status code if applicable (e.g., 429, 503) */
  readonly statusCode?: number;
  /** Node.js or system error code (e.g., ECONNRESET) */
  readonly errorCode?: string;

  constructor(
    message: string,
    source: string,
    isRetryable: boolean,
    options?: DataSourceErrorOptions | Error
  ) {
    super(message);
    this.name = "DataSourceError";
    this.source = source;
    this.isRetryable = isRetryable;

    // Support both old signature (Error) and new signature (options)
    if (options instanceof Error) {
      this.originalError = options;
    } else if (options) {
      this.originalError = options.originalError;
      this.statusCode = options.statusCode;
      this.errorCode = options.errorCode;
    }
  }
}
