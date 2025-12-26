import type { ResearchDataSource } from "./data-source.interface.js";
import { MockDataSource } from "./mock-source.js";
import { TavilyDataSource } from "./tavily-source.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("data-source-factory");

export type DataSourceType = "mock" | "tavily" | "auto";

/**
 * Create a data source based on configuration.
 *
 * @param type - Explicit type or "auto" to detect from environment
 * @returns Configured data source
 */
export function createDataSource(
  type: DataSourceType = "auto"
): ResearchDataSource {
  // Auto-detect based on environment
  if (type === "auto") {
    const envType = process.env.RESEARCH_DATA_SOURCE as
      | DataSourceType
      | undefined;
    type = envType ?? "mock";

    // If Tavily requested but not available, warn and fall back
    if (type === "tavily" && !process.env.TAVILY_API_KEY) {
      logger.warn(
        "Tavily requested but TAVILY_API_KEY not set, falling back to mock"
      );
      type = "mock";
    }

    // Auto with Tavily key available → use Tavily
    if (type === "auto" && process.env.TAVILY_API_KEY) {
      type = "tavily";
    }
  }

  switch (type) {
    case "tavily":
      if (!process.env.TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY required for Tavily data source");
      }
      logger.info("Using Tavily data source");
      return new TavilyDataSource();

    case "mock":
    default:
      logger.info("Using Mock data source");
      return new MockDataSource();
  }
}

export { MockDataSource } from "./mock-source.js";
export { TavilyDataSource } from "./tavily-source.js";
export type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
export { DataSourceError } from "./data-source.interface.js";
