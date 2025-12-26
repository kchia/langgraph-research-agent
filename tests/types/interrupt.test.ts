import { describe, it, expect } from "vitest";
import {
  isInterruptData,
  validateInterruptData,
  isClarificationResponse,
  validateClarificationResponse
} from "../../src/types/interrupt.js";

describe("interrupt types", () => {
  describe("isInterruptData", () => {
    it("should return true for valid interrupt data", () => {
      const validData = {
        type: "clarification_needed",
        question: "Which company?",
        originalQuery: "Tell me about it",
        attempt: 1
      };

      expect(isInterruptData(validData)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isInterruptData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isInterruptData(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isInterruptData("string")).toBe(false);
      expect(isInterruptData(123)).toBe(false);
      expect(isInterruptData([])).toBe(false);
    });

    it("should return false for missing required fields", () => {
      expect(isInterruptData({})).toBe(false);
      expect(isInterruptData({ type: "test" })).toBe(false);
      expect(isInterruptData({ type: "test", question: "test" })).toBe(false);
    });

    it("should return false for wrong field types", () => {
      expect(
        isInterruptData({
          type: 123, // should be string
          question: "test",
          originalQuery: "test",
          attempt: 1
        })
      ).toBe(false);

      expect(
        isInterruptData({
          type: "test",
          question: "test",
          originalQuery: "test",
          attempt: "1" // should be number
        })
      ).toBe(false);
    });

    it("should return false for negative attempt", () => {
      expect(
        isInterruptData({
          type: "test",
          question: "test",
          originalQuery: "test",
          attempt: -1
        })
      ).toBe(false);
    });
  });

  describe("validateInterruptData", () => {
    it("should return validated data for valid input", () => {
      const validData = {
        type: "clarification_needed",
        question: "Which company?",
        originalQuery: "Tell me about it",
        attempt: 1
      };

      const result = validateInterruptData(validData);
      expect(result).toEqual(validData);
    });

    it("should return null for invalid input", () => {
      expect(validateInterruptData(null)).toBeNull();
      expect(validateInterruptData(undefined)).toBeNull();
      expect(validateInterruptData("invalid")).toBeNull();
      expect(validateInterruptData({})).toBeNull();
    });

    it("should return null for data with wrong types", () => {
      expect(
        validateInterruptData({
          type: 123,
          question: "test",
          originalQuery: "test",
          attempt: 1
        })
      ).toBeNull();
    });
  });

  describe("isClarificationResponse", () => {
    it("should return true for non-empty string", () => {
      expect(isClarificationResponse("test")).toBe(true);
      expect(isClarificationResponse("  test  ")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isClarificationResponse("")).toBe(false);
      expect(isClarificationResponse("   ")).toBe(false);
    });

    it("should return false for non-string", () => {
      expect(isClarificationResponse(null)).toBe(false);
      expect(isClarificationResponse(undefined)).toBe(false);
      expect(isClarificationResponse(123)).toBe(false);
      expect(isClarificationResponse({})).toBe(false);
    });
  });

  describe("validateClarificationResponse", () => {
    it("should return trimmed string for valid input", () => {
      expect(validateClarificationResponse("  test  ")).toBe("test");
      expect(validateClarificationResponse("test")).toBe("test");
    });

    it("should throw for invalid input", () => {
      expect(() => validateClarificationResponse("")).toThrow();
      expect(() => validateClarificationResponse("   ")).toThrow();
      expect(() => validateClarificationResponse(null)).toThrow();
      expect(() => validateClarificationResponse(123)).toThrow();
    });
  });
});
