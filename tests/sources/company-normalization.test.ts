import { describe, it, expect } from "vitest";
import { normalizeCompanyName } from "../../src/sources/company-normalization.js";

describe("company-normalization", () => {
  describe("normalizeCompanyName", () => {
    it("should return null for null input", () => {
      expect(normalizeCompanyName(null)).toBeNull();
    });

    it("should normalize common company names", () => {
      expect(normalizeCompanyName("apple")).toBe("Apple Inc.");
      expect(normalizeCompanyName("tesla")).toBe("Tesla, Inc.");
      expect(normalizeCompanyName("microsoft")).toBe("Microsoft Corporation");
      expect(normalizeCompanyName("google")).toBe("Alphabet Inc.");
    });

    it("should handle case variations", () => {
      expect(normalizeCompanyName("APPLE")).toBe("Apple Inc.");
      expect(normalizeCompanyName("Apple")).toBe("Apple Inc.");
      expect(normalizeCompanyName("aPpLe")).toBe("Apple Inc.");
    });

    it("should preserve names with suffixes", () => {
      expect(normalizeCompanyName("Apple Inc.")).toBe("Apple Inc.");
      expect(normalizeCompanyName("Tesla Corporation")).toBe(
        "Tesla Corporation"
      );
      expect(normalizeCompanyName("Microsoft Corp.")).toBe("Microsoft Corp.");
    });

    it("should handle partial matches", () => {
      expect(normalizeCompanyName("Apple Inc")).toBe("Apple Inc.");
      expect(normalizeCompanyName("Tesla Motors")).toBe("Tesla, Inc.");
    });

    it("should return as-is for unknown companies", () => {
      expect(normalizeCompanyName("Unknown Company")).toBe("Unknown Company");
      expect(normalizeCompanyName("XYZ Corp")).toBe("XYZ Corp");
    });

    it("should trim whitespace", () => {
      expect(normalizeCompanyName("  apple  ")).toBe("Apple Inc.");
      expect(normalizeCompanyName("\t\ntesla\n\t")).toBe("Tesla, Inc.");
    });
  });
});
