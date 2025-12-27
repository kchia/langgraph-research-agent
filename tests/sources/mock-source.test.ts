import { describe, it, expect, beforeEach } from "vitest";
import { MockDataSource } from "../../src/sources/mock-source.js";
import type { SearchContext } from "../../src/sources/data-source.interface.js";

describe("MockDataSource", () => {
  let source: MockDataSource;
  const baseContext: SearchContext = {
    originalQuery: "test query",
    attemptNumber: 1
  };

  beforeEach(() => {
    source = new MockDataSource();
  });

  describe("getName", () => {
    it("should return 'Mock Data Source'", () => {
      expect(source.getName()).toBe("Mock Data Source");
    });
  });

  describe("isAvailable", () => {
    it("should always return true", () => {
      expect(source.isAvailable()).toBe(true);
    });
  });

  describe("search", () => {
    it("should return partial data with low confidence on first attempt", async () => {
      const result = await source.search("Apple Inc.", baseContext);

      expect(result.findings).not.toBeNull();
      expect(result.findings?.company).toBe("Apple Inc.");
      // First attempt returns partial data to trigger validation
      expect(result.confidence).toBe(4);
      expect(result.findings?.recentNews).not.toBeNull();
      expect(result.findings?.stockInfo).toBeNull(); // Omitted on first attempt
      expect(result.findings?.keyDevelopments).toBeNull(); // Omitted on first attempt
      expect(result.source).toBe("Mock Data Source");
    });

    it("should return complete data with high confidence on retry with feedback", async () => {
      const retryContext: SearchContext = {
        ...baseContext,
        attemptNumber: 2,
        validationFeedback: "Missing financial data"
      };
      const result = await source.search("Apple Inc.", retryContext);

      expect(result.findings).not.toBeNull();
      expect(result.findings?.company).toBe("Apple Inc.");
      // Retry with feedback returns complete data
      expect(result.confidence).toBeGreaterThan(6);
      expect(result.findings?.recentNews).not.toBeNull();
      expect(result.findings?.stockInfo).not.toBeNull();
      expect(result.findings?.keyDevelopments).not.toBeNull();
    });

    it.each([
      ["apple", "Apple Inc."],
      ["APPLE", "Apple Inc."],
      ["Apple Inc.", "Apple Inc."],
      ["apple inc", "Apple Inc."],
      ["Apple, Inc.", "Apple Inc."]
    ])("should normalize '%s' to '%s'", async (input, expected) => {
      const result = await source.search(input, baseContext);
      expect(result.findings?.company).toBe(expected);
    });

    it("should return null findings for unknown companies", async () => {
      const result = await source.search("Unknown Corp", baseContext);

      expect(result.findings).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it("should track validation feedback in raw data on retry", async () => {
      const contextWithFeedback: SearchContext = {
        ...baseContext,
        validationFeedback: "Missing financial data",
        attemptNumber: 2
      };

      const result = await source.search("Apple", contextWithFeedback);

      expect(result.findings?.rawData.hadFeedback).toBe(true);
      expect(result.findings?.rawData.attemptNumber).toBe(2);
      expect(result.findings?.rawData.usedFeedback).toBe("Missing financial data");
    });

    it.each(["Apple", "Tesla", "Microsoft", "Amazon", "Google"])(
      "should return findings for known company '%s'",
      async (company) => {
        const result = await source.search(company, baseContext);
        expect(result.findings).not.toBeNull();
        expect(result.findings?.company).toBeDefined();
      }
    );
  });
});
