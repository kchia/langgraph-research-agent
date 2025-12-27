import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDataSource } from "../../src/sources/index.js";

describe("createDataSource factory", () => {
  let originalDataSource: string | undefined;
  let originalTavilyKey: string | undefined;

  beforeEach(() => {
    originalDataSource = process.env.RESEARCH_DATA_SOURCE;
    originalTavilyKey = process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (originalDataSource !== undefined) {
      process.env.RESEARCH_DATA_SOURCE = originalDataSource;
    } else {
      delete process.env.RESEARCH_DATA_SOURCE;
    }
    if (originalTavilyKey !== undefined) {
      process.env.TAVILY_API_KEY = originalTavilyKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  it("should create MockDataSource when type is 'mock'", () => {
    const source = createDataSource("mock");
    expect(source.getName()).toBe("Mock Data Source");
  });

  it("should create MockDataSource when auto and no Tavily key", () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.RESEARCH_DATA_SOURCE;

    const source = createDataSource("auto");
    expect(source.getName()).toBe("Mock Data Source");
  });

  it("should throw when tavily requested without key", () => {
    delete process.env.TAVILY_API_KEY;

    expect(() => createDataSource("tavily")).toThrow("TAVILY_API_KEY required");
  });

  it("should fall back to mock when env says tavily but no key", () => {
    process.env.RESEARCH_DATA_SOURCE = "tavily";
    delete process.env.TAVILY_API_KEY;

    // Auto-detection should fall back
    const source = createDataSource("auto");
    expect(source.getName()).toBe("Mock Data Source");
  });
});
