import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
import { DataSourceError } from "./data-source.interface.js";
import type { ResearchFindings } from "../graph/state.js";
import { Logger } from "../utils/logger.js";
import { isRetryableError, withRetry } from "../utils/retry.js";
import { tavilyCircuitBreaker } from "../utils/resilience.js";

const logger = new Logger("tavily-source");

/**
 * Zod schema for a single Tavily search result item.
 */
const TavilyResultItemSchema = z
  .object({
    content: z.string().optional(),
    snippet: z.string().optional(),
    url: z.string().optional()
  })
  .passthrough();

/**
 * Zod schema for Tavily response with results array.
 */
const TavilyResultsArraySchema = z.array(TavilyResultItemSchema).min(1);

/**
 * Zod schema for Tavily response with answer string.
 */
const TavilyAnswerSchema = z
  .object({
    answer: z.string()
  })
  .passthrough();

/**
 * Zod schema for Tavily response with results property.
 */
const TavilyResultsObjectSchema = z
  .object({
    results: z.array(TavilyResultItemSchema).min(1)
  })
  .passthrough();

/**
 * Zod schema for string response from Tavily.
 */
const TavilyStringSchema = z.string();

interface TavilyConfig {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
}

export class TavilyDataSource implements ResearchDataSource {
  private tool: TavilySearch | null = null;
  private config: TavilyConfig;

  constructor(config: TavilyConfig = {}) {
    this.config = {
      maxResults: config.maxResults ?? 5,
      searchDepth: config.searchDepth ?? "advanced",
      includeAnswer: config.includeAnswer ?? true
    };
  }

  private getTool(): TavilySearch {
    if (!this.tool) {
      this.tool = new TavilySearch({
        maxResults: this.config.maxResults,
        searchDepth: this.config.searchDepth,
        includeAnswer: this.config.includeAnswer
      });
    }
    return this.tool;
  }

  getName(): string {
    return "Tavily Search";
  }

  isAvailable(): boolean {
    return !!process.env.TAVILY_API_KEY;
  }

  async search(company: string, context: SearchContext): Promise<SearchResult> {
    if (!this.isAvailable()) {
      throw new DataSourceError(
        "Tavily API key not configured",
        this.getName(),
        false
      );
    }

    const query = this.buildSearchQuery(company, context);
    logger.info("Tavily search started", {
      company,
      query,
      attempt: context.attemptNumber
    });

    try {
      // Use retry with circuit breaker for resilience against transient failures
      // Retry logic handles rate limits and timeouts with exponential backoff
      // Circuit breaker prevents cascade failures after sustained failures
      const rawResult = await withRetry(
        () =>
          tavilyCircuitBreaker.execute(async () => {
            return this.getTool().invoke({ query });
          }),
        {
          retries: 2,
          correlationId: context.correlationId,
          operation: "tavily-search"
        }
      );

      logger.info("Tavily search completed", {
        company,
        hasResult: !!rawResult
      });

      const findings = this.parseResults(company, rawResult);
      const confidence = this.calculateConfidence(findings, rawResult);

      return {
        findings,
        confidence,
        source: this.getName(),
        rawResponse: rawResult
      };
    } catch (error) {
      // Check if circuit is open (fast-fail)
      const isCircuitOpen =
        error instanceof Error && error.message.includes("circuit is open");

      if (isCircuitOpen) {
        logger.warn("Tavily circuit breaker is open, failing fast", {
          company
        });
      } else {
        logger.error("Tavily search failed", {
          company,
          error: String(error)
        });
      }

      const retryable = isRetryableError(error);
      // Extract structured error properties for reliable detection
      const anyError = error as Record<string, unknown>;
      throw new DataSourceError(
        isCircuitOpen
          ? "Tavily service temporarily unavailable (circuit breaker open)"
          : `Tavily search failed: ${error instanceof Error ? error.message : "Unknown"}`,
        this.getName(),
        retryable,
        {
          originalError: error instanceof Error ? error : undefined,
          statusCode: typeof anyError.status === "number" ? anyError.status : undefined,
          errorCode: typeof anyError.code === "string" ? anyError.code : undefined
        }
      );
    }
  }

  private buildSearchQuery(company: string, context: SearchContext): string {
    const baseQuery = `${company} company`;
    const focusAreas = ["latest news", "stock price", "recent developments"];

    // Incorporate validation feedback
    if (context.validationFeedback) {
      const feedback = context.validationFeedback.toLowerCase();
      if (feedback.includes("financial")) {
        focusAreas.push("earnings", "revenue");
      }
      if (feedback.includes("news")) {
        focusAreas.push("breaking news", "announcements");
      }
    }

    return `${baseQuery} ${focusAreas.slice(0, 3).join(" ")}`;
  }

  private parseResults(
    company: string,
    rawResult: unknown
  ): ResearchFindings | null {
    // Try to parse as string response (Tavily can return a string answer)
    const stringResult = TavilyStringSchema.safeParse(rawResult);
    if (stringResult.success) {
      return {
        company,
        recentNews: stringResult.data.slice(0, 500),
        stockInfo: null,
        keyDevelopments: null,
        sources: [this.getName()],
        rawData: { type: "string" }
      };
    }

    // Try to parse as array of results
    const arrayResult = TavilyResultsArraySchema.safeParse(rawResult);
    if (arrayResult.success) {
      const combinedContent = arrayResult.data
        .map((r) => r.content || r.snippet || "")
        .join("\n\n");

      return {
        company,
        recentNews: this.extractSection(combinedContent, "news"),
        stockInfo: this.extractSection(combinedContent, "stock"),
        keyDevelopments: this.extractSection(combinedContent, "developments"),
        sources: arrayResult.data
          .slice(0, 5)
          .map((r) => r.url || this.getName()),
        rawData: { resultCount: arrayResult.data.length }
      };
    }

    // Try to parse as object with results property
    const resultsObjectResult = TavilyResultsObjectSchema.safeParse(rawResult);
    if (resultsObjectResult.success) {
      return this.parseResults(company, resultsObjectResult.data.results);
    }

    // Try to parse as object with answer property
    const answerResult = TavilyAnswerSchema.safeParse(rawResult);
    if (answerResult.success) {
      return {
        company,
        recentNews: answerResult.data.answer.slice(0, 500),
        stockInfo: null,
        keyDevelopments: null,
        sources: [this.getName()],
        rawData: { hasAnswer: true }
      };
    }

    // If none of the schemas match, return null
    logger.warn("Unable to parse Tavily response", {
      resultType: typeof rawResult,
      isArray: Array.isArray(rawResult)
    });
    return null;
  }

  private extractSection(
    content: string,
    type: "news" | "stock" | "developments"
  ): string | null {
    const patterns: Record<string, RegExp[]> = {
      news: [/\b(announced|launched|released|reported)\b/i],
      stock: [/\$[\d,.]+/, /trading at/i, /market cap/i],
      developments: [
        /\b(AI|artificial intelligence|new product|partnership)\b/i
      ]
    };

    const sentences = content.split(/[.!?]+/);
    const relevant = sentences.filter((s) =>
      patterns[type].some((p) => p.test(s))
    );

    return relevant.length > 0
      ? relevant.slice(0, 3).join(". ").slice(0, 400) + "."
      : null;
  }

  private calculateConfidence(
    findings: ResearchFindings | null,
    rawResult: unknown
  ): number {
    if (!findings) return 0;

    let score = 0;
    if (findings.recentNews && findings.recentNews.length > 100) score += 3;
    else if (findings.recentNews) score += 1;

    if (findings.stockInfo) score += 3;

    if (findings.keyDevelopments && findings.keyDevelopments.length > 100)
      score += 3;
    else if (findings.keyDevelopments) score += 1;

    if (findings.sources.length >= 3) score += 1;

    return Math.min(10, score);
  }

  // isRetryableError is imported from retry.ts - single source of truth
}
