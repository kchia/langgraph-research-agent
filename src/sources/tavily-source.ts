import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
import { DataSourceError } from "./data-source.interface.js";
import type { ResearchFindings } from "../graph/state.js";
import { ResearchFindingsSchema } from "../graph/state.js";
import { Logger } from "../utils/logger.js";
import { isRetryableError, withRetry } from "../utils/retry.js";
import { createLLM, supportsStructuredOutput } from "../utils/llm-factory.js";
import { HumanMessage } from "@langchain/core/messages";

const logger = new Logger("tavily-source");

/**
 * Topic keywords that indicate specific research interests.
 * Used to extract user intent from queries and build targeted search queries.
 */
const TOPIC_KEYWORDS = {
  competitors: [
    "competitor",
    "competitors",
    "competition",
    "competitive",
    "rival",
    "rivals",
    "vs",
    "versus",
    "compare",
    "comparison",
    "market share"
  ],
  financial: [
    "stock",
    "stock price",
    "share price",
    "trading",
    "financial",
    "revenue",
    "earnings",
    "profit",
    "market cap",
    "valuation",
    "dividend",
    "pe ratio",
    "financial metrics"
  ],
  products: [
    "product",
    "products",
    "service",
    "services",
    "offering",
    "offerings",
    "launch",
    "launched"
  ],
  leadership: [
    "ceo",
    "executive",
    "executives",
    "leadership",
    "management",
    "founder",
    "founders"
  ],
  news: ["news", "announcement", "announcements", "update", "updates", "recent"]
};

/**
 * Extract relevant topics from a user query.
 * Returns an array of topic categories that the query mentions.
 */
function extractTopicsFromQuery(query: string): string[] {
  if (!query || !query.trim()) {
    return [];
  }

  const lowerQuery = query.toLowerCase();
  const detectedTopics: string[] = [];

  // Check each topic category
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hasTopic = keywords.some((keyword) => lowerQuery.includes(keyword));
    if (hasTopic) {
      detectedTopics.push(topic);
    }
  }

  return detectedTopics;
}

/**
 * Build search query terms based on detected topics.
 * Converts topic categories into search-friendly terms.
 */
function buildTopicQueryTerms(topics: string[]): string {
  if (topics.length === 0) {
    return "";
  }

  const termMap: Record<string, string> = {
    competitors: "competitors competitive landscape market share",
    financial: "stock price trading financial metrics revenue earnings",
    products: "products services offerings",
    leadership: "executives leadership management",
    news: "latest news announcements updates"
  };

  const terms = topics
    .map((topic) => termMap[topic])
    .filter(Boolean)
    .join(" ");

  return terms;
}

/**
 * Zod schema for Tavily response - handles string answers, result arrays, and object responses.
 * When includeAnswer is true, Tavily returns an object with { answer?: string, results?: array }
 */
const TavilyResponseSchema = z.union([
  z.string(),
  z.array(
    z
      .object({
        content: z.string().optional(),
        url: z.string().optional()
      })
      .passthrough()
  ),
  z
    .object({
      answer: z.string().optional(),
      results: z
        .array(
          z
            .object({
              content: z.string().optional(),
              url: z.string().optional()
            })
            .passthrough()
        )
        .optional()
    })
    .passthrough()
]);

/**
 * Schema for structured extraction of stock info and key developments from research content.
 */
const StructuredExtractionSchema = z.object({
  stockInfo: z
    .string()
    .nullable()
    .describe(
      "Stock/financial information including ticker symbol, current price, market cap, trading performance, or null if not found"
    ),
  keyDevelopments: z
    .string()
    .nullable()
    .describe(
      "Key business developments, strategic initiatives, product launches, or major company milestones, or null if not found"
    )
});

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
      const rawResult = await withRetry(
        () => this.getTool().invoke({ query }),
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

      const findings = await this.parseResults(company, rawResult);
      const confidence = this.calculateConfidence(findings);

      return {
        findings,
        confidence,
        source: this.getName(),
        rawResponse: rawResult
      };
    } catch (error) {
      logger.error("Tavily search failed", {
        company,
        error: String(error)
      });

      throw new DataSourceError(
        `Tavily search failed: ${
          error instanceof Error ? error.message : "Unknown"
        }`,
        this.getName(),
        isRetryableError(error)
      );
    }
  }

  private buildSearchQuery(company: string, context: SearchContext): string {
    // Extract topics from the original query to understand user intent
    const detectedTopics = extractTopicsFromQuery(context.originalQuery);
    const topicTerms = buildTopicQueryTerms(detectedTopics);

    // Build base query with company name
    let query = `${company} company`;

    // If specific topics were detected, use them to build a targeted query
    if (topicTerms) {
      query = `${query} ${topicTerms}`;
      // Still include some general terms for comprehensive results
      query = `${query} latest news developments`;
    } else {
      // No specific topics detected - use comprehensive generic template
      query = `${query} latest news stock price financial metrics key developments strategic initiatives`;
    }

    // Add validation feedback if this is a retry
    if (context.validationFeedback) {
      query = `${query} ${context.validationFeedback}`;
    }

    return query;
  }

  private async parseResults(
    company: string,
    rawResult: unknown
  ): Promise<ResearchFindings | null> {
    const parsed = TavilyResponseSchema.safeParse(rawResult);
    if (!parsed.success) {
      logger.warn("Unable to parse Tavily response", {
        resultType: typeof rawResult,
        isArray: Array.isArray(rawResult),
        error: parsed.error.errors
      });
      return null;
    }

    let content: string;
    let sources: string[];
    let resultCount: number;

    // Handle string response (direct answer)
    if (typeof parsed.data === "string") {
      content = parsed.data;
      sources = [this.getName()];
      resultCount = 1;
    }
    // Handle array response (results array)
    else if (Array.isArray(parsed.data)) {
      content = parsed.data.map((r) => r.content || "").join("\n\n");
      sources = parsed.data
        .slice(0, 5)
        .map((r) => r.url || this.getName())
        .filter((s) => s !== this.getName() || parsed.data.length === 0);
      resultCount = parsed.data.length;
    }
    // Handle object response (with answer and/or results)
    else {
      const answer = parsed.data.answer || "";
      const results = parsed.data.results || [];

      // Combine answer with results content
      const resultsContent = results.map((r) => r.content || "").join("\n\n");
      content = [answer, resultsContent].filter(Boolean).join("\n\n");

      sources = results
        .slice(0, 5)
        .map((r) => r.url || this.getName())
        .filter((s) => s !== this.getName() || results.length === 0);

      resultCount = results.length + (answer ? 1 : 0);
    }

    if (!content || content.trim().length === 0) {
      return null;
    }

    // Extract structured information (stock info and key developments)
    const extracted = await this.extractStructuredInfo(company, content);

    const findings: ResearchFindings = {
      company,
      recentNews: content || null,
      stockInfo: extracted.stockInfo,
      keyDevelopments: extracted.keyDevelopments,
      sources: sources.length > 0 ? sources : [this.getName()],
      rawData: {
        resultCount,
        extracted: !!extracted.stockInfo || !!extracted.keyDevelopments
      }
    };

    // Validate findings with Zod schema before returning
    const validated = ResearchFindingsSchema.safeParse(findings);
    if (!validated.success) {
      logger.error("Research findings failed Zod validation", {
        errors: validated.error.errors,
        findings
      });
      // Return a minimal valid structure if validation fails
      return {
        company,
        recentNews: content || null,
        stockInfo: null,
        keyDevelopments: null,
        sources: sources.length > 0 ? sources : [this.getName()],
        rawData: { resultCount, validationError: true }
      };
    }

    return validated.data;
  }

  /**
   * Extract structured information (stock info and key developments) from research content.
   * Uses LLM with structured output for accurate extraction.
   */
  private async extractStructuredInfo(
    company: string,
    content: string
  ): Promise<{ stockInfo: string | null; keyDevelopments: string | null }> {
    try {
      const llm = createLLM("synthesis");

      if (!supportsStructuredOutput(llm)) {
        logger.warn(
          "LLM does not support structured output, using fallback extraction"
        );
        return this.fallbackExtraction(content);
      }

      const structuredLLM = llm.withStructuredOutput(
        StructuredExtractionSchema,
        {
          name: "extract_research_info"
        }
      );

      const prompt = `Extract structured information about ${company} from the following research content.

Focus on:
1. **Stock Info**: Extract stock ticker symbol, current trading price, market cap, P/E ratio, trading performance (YTD, quarterly changes), dividend information, or any financial metrics mentioned. Format as a concise summary like "AAPL trading at $195, up 45% YTD. Market cap: $3.0T."

2. **Key Developments**: Extract major business developments, strategic initiatives, product launches, partnerships, expansions, technology rollouts, or significant company milestones. Format as a concise summary of the most important developments.

If information is not found in the content, return null for that field.

Research content:
${content}`;

      const result = await structuredLLM.invoke([new HumanMessage(prompt)]);

      // Validate the LLM extraction result with Zod for type safety
      const validated = StructuredExtractionSchema.safeParse(result);
      if (!validated.success) {
        logger.warn("LLM extraction result failed Zod validation", {
          errors: validated.error.errors
        });
        return this.fallbackExtraction(content);
      }

      return {
        stockInfo: validated.data.stockInfo,
        keyDevelopments: validated.data.keyDevelopments
      };
    } catch (error) {
      logger.warn(
        "Failed to extract structured info with LLM, using fallback",
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      return this.fallbackExtraction(content);
    }
  }

  /**
   * Fallback extraction using pattern matching when LLM extraction fails.
   */
  private fallbackExtraction(content: string): {
    stockInfo: string | null;
    keyDevelopments: string | null;
  } {
    // Extract stock info using patterns
    const stockPatterns = [
      /(?:trading|trades?|price|at)\s+(?:at\s+)?\$?([\d,]+\.?\d*)/gi,
      /(?:stock|ticker|symbol)\s+([A-Z]{1,5})/gi,
      /(?:market\s+cap|marketcap)\s*:?\s*\$?([\d.]+[BMKT]?)/gi,
      /(?:up|down|gained|lost)\s+(\d+%)\s+(?:YTD|year|quarter)/gi
    ];

    const stockMatches: string[] = [];
    stockPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        stockMatches.push(...matches);
      }
    });

    const stockInfo =
      stockMatches.length > 0 ? stockMatches.slice(0, 3).join(". ") : null;

    // Extract key developments - look for action verbs and important phrases
    const developmentKeywords = [
      /(?:launched|announced|released|introduced|unveiled)\s+[^.]{10,100}/gi,
      /(?:partnership|deal|acquisition|merger|expansion)\s+[^.]{10,100}/gi,
      /(?:rollout|deployment|integration|expansion)\s+[^.]{10,100}/gi
    ];

    const devMatches: string[] = [];
    developmentKeywords.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        devMatches.push(...matches);
      }
    });

    const keyDevelopments =
      devMatches.length > 0 ? devMatches.slice(0, 3).join(". ") : null;

    return { stockInfo, keyDevelopments };
  }

  private calculateConfidence(findings: ResearchFindings | null): number {
    if (!findings || !findings.recentNews) return 0;

    let score = 0;

    // Base score from content length
    const len = findings.recentNews.length;
    if (len > 500) score += 4;
    else if (len > 200) score += 3;
    else score += 2;

    // Bonus for structured data (similar to mock source)
    if (findings.stockInfo) score += 3;
    if (findings.keyDevelopments) score += 3;

    return Math.min(score, 10); // Cap at 10
  }
}
