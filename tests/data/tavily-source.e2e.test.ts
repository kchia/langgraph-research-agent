import { describe, it, expect, beforeEach } from "vitest";
import { TavilyDataSource } from "../../src/data/tavily-source.js";

const hasTavilyKey = !!process.env.TAVILY_API_KEY;

describe("TavilyDataSource", () => {
  describe("isAvailable", () => {
    it("should return false without API key", () => {
      const originalKey = process.env.TAVILY_API_KEY;
      delete process.env.TAVILY_API_KEY;

      const source = new TavilyDataSource();
      expect(source.isAvailable()).toBe(false);

      if (originalKey) process.env.TAVILY_API_KEY = originalKey;
    });

    it.skipIf(!hasTavilyKey)("should return true with API key", () => {
      const source = new TavilyDataSource();
      expect(source.isAvailable()).toBe(true);
    });
  });

  describe("getName", () => {
    it("should return 'Tavily Search'", () => {
      const source = new TavilyDataSource();
      expect(source.getName()).toBe("Tavily Search");
    });
  });

  describe.skipIf(!hasTavilyKey)("search (requires API key)", () => {
    let source: TavilyDataSource;

    beforeEach(() => {
      source = new TavilyDataSource();
    });

    it("should search for real company data", async () => {
      const result = await source.search("Apple Inc.", {
        originalQuery: "Latest Apple news",
        attemptNumber: 1
      });

      expect(result.findings).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.source).toBe("Tavily Search");
    }, 30000);

    it("should handle validation feedback in query", async () => {
      const result = await source.search("Microsoft", {
        originalQuery: "Microsoft info",
        validationFeedback: "Missing financial data",
        attemptNumber: 2
      });

      expect(result.findings).not.toBeNull();
    }, 30000);
  });
});
