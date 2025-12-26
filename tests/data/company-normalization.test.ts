import { describe, it, expect } from "vitest";
import {
  normalizeCompanyName,
  DEFAULT_COMPANY_MAP,
  createNormalizationConfig,
  DEFAULT_NORMALIZATION_CONFIG
} from "../../src/data/company-normalization.js";

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

    it("should use custom configuration", () => {
      const customConfig = createNormalizationConfig({
        companyMap: {
          custom: "Custom Company Inc."
        }
      });

      expect(normalizeCompanyName("custom", customConfig)).toBe(
        "Custom Company Inc."
      );
      // Should still work with defaults
      expect(normalizeCompanyName("apple", customConfig)).toBe("Apple Inc.");
    });

    it("should merge custom configuration with defaults", () => {
      const customConfig = createNormalizationConfig({
        companyMap: {
          newcompany: "New Company Inc."
        }
      });

      expect(normalizeCompanyName("newcompany", customConfig)).toBe(
        "New Company Inc."
      );
      expect(normalizeCompanyName("apple", customConfig)).toBe("Apple Inc.");
    });

    it("should handle custom suffixes", () => {
      const customConfig = createNormalizationConfig({
        suffixes: ["GmbH", "AG"]
      });

      expect(normalizeCompanyName("Siemens GmbH", customConfig)).toBe(
        "Siemens GmbH"
      );
      expect(normalizeCompanyName("SAP AG", customConfig)).toBe("SAP AG");
    });
  });

  describe("createNormalizationConfig", () => {
    it("should create config with defaults if no overrides", () => {
      const config = createNormalizationConfig({});
      expect(config.companyMap).toEqual(DEFAULT_COMPANY_MAP);
      expect(config.suffixes).toEqual(DEFAULT_NORMALIZATION_CONFIG.suffixes);
    });

    it("should merge company map overrides", () => {
      const config = createNormalizationConfig({
        companyMap: {
          test: "Test Company"
        }
      });

      expect(config.companyMap.test).toBe("Test Company");
      expect(config.companyMap.apple).toBe("Apple Inc."); // Default preserved
    });

    it("should override suffixes", () => {
      const config = createNormalizationConfig({
        suffixes: ["Custom"]
      });

      expect(config.suffixes).toEqual(["Custom"]);
    });
  });
});
