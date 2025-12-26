import { describe, it, expect } from "vitest";
import {
  validateQuery,
  validateAndNormalizeQuery
} from "../../src/utils/input-validation.js";

describe("input-validation", () => {
  describe("validateQuery", () => {
    it("should validate a normal query", () => {
      const result = validateQuery("Tell me about Apple");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject non-string input", () => {
      expect(validateQuery(null).valid).toBe(false);
      expect(validateQuery(undefined).valid).toBe(false);
      expect(validateQuery(123).valid).toBe(false);
      expect(validateQuery({}).valid).toBe(false);
      expect(validateQuery([]).valid).toBe(false);
    });

    it("should reject empty string", () => {
      const result = validateQuery("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject whitespace-only string", () => {
      const result = validateQuery("   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("should reject query that is too long", () => {
      const longQuery = "a".repeat(5001);
      const result = validateQuery(longQuery);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("should accept query at max length", () => {
      const maxQuery = "a".repeat(5000);
      const result = validateQuery(maxQuery);
      expect(result.valid).toBe(true);
    });

    it("should reject query with null bytes", () => {
      const result = validateQuery("test\0query");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("null bytes");
    });

    it("should provide helpful error messages", () => {
      const result = validateQuery(null);
      expect(result.error).toContain("string");
    });
  });

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
