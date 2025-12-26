import { describe, it, expect, beforeEach } from "vitest";
import { MockDataSource } from "../../src/data/mock-source.js";
import type { SearchContext } from "../../src/data/data-source.interface.js";

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
    it("should return data for known companies", async () => {
      const result = await source.search("Apple Inc.", baseContext);

      expect(result.findings).not.toBeNull();
      expect(result.findings?.company).toBe("Apple Inc.");
      expect(result.confidence).toBeGreaterThan(6);
      expect(result.source).toBe("Mock Data Source");
    });

    it("should normalize company names correctly", async () => {
      const variations = [
        "apple",
        "APPLE",
        "Apple Inc.",
        "apple inc",
        "Apple, Inc."
      ];

      for (const variant of variations) {
        const result = await source.search(variant, baseContext);
        expect(result.findings?.company).toBe("Apple Inc.");
      }
    });

    it("should return null findings for unknown companies", async () => {
      const result = await source.search("Unknown Corp", baseContext);

      expect(result.findings).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it("should track validation feedback in raw data", async () => {
      const contextWithFeedback: SearchContext = {
        ...baseContext,
        validationFeedback: "Missing financial data",
        attemptNumber: 2
      };

      const result = await source.search("Apple", contextWithFeedback);

      expect(result.findings?.rawData.hadFeedback).toBe(true);
      expect(result.findings?.rawData.attemptNumber).toBe(2);
    });

    it("should return all 5 known companies", async () => {
      const companies = ["Apple", "Tesla", "Microsoft", "Amazon", "Google"];

      for (const company of companies) {
        const result = await source.search(company, baseContext);
        expect(result.findings).not.toBeNull();
      }
    });
  });
});
