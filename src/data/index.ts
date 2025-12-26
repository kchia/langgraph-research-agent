import type { ResearchDataSource } from "./data-source.interface.js";
import { MockDataSource } from "./mock-source.js";

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
  // For now, only mock is implemented
  // Tavily will be added in Commit 15
  if (type === "tavily") {
    console.warn("Tavily not yet implemented, falling back to mock");
  }
  return new MockDataSource();
}

export { MockDataSource } from "./mock-source.js";
export type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
export { DataSourceError } from "./data-source.interface.js";
