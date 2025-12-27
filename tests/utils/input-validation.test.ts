import { describe, it, expect } from "vitest";
import { validateAndNormalizeQuery } from "../../src/utils/input-validation.js";

describe("input-validation", () => {
  describe("validateAndNormalizeQuery", () => {
    it("should return trimmed query for valid input", () => {
      const result = validateAndNormalizeQuery("  Tell me about Apple  ");
      expect(result).toBe("Tell me about Apple");
    });

    it("should throw error for invalid input", () => {
      expect(() => validateAndNormalizeQuery("")).toThrow("Invalid query");
      expect(() => validateAndNormalizeQuery(null)).toThrow("Invalid query");
      expect(() => validateAndNormalizeQuery("   ")).toThrow("Invalid query");
    });

    it("should include error message in thrown error", () => {
      try {
        validateAndNormalizeQuery("");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("empty");
      }
    });

    it("should handle normal queries", () => {
      expect(validateAndNormalizeQuery("Apple")).toBe("Apple");
      expect(validateAndNormalizeQuery("What about Tesla?")).toBe(
        "What about Tesla?"
      );
    });
  });
});
