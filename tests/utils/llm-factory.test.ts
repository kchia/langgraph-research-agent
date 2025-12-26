import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLLM, clearLLMCache } from "../../src/utils/llm-factory.js";

describe("llm-factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment and cache
    process.env = { ...originalEnv };
    clearLLMCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearLLMCache();
  });

  describe("createLLM", () => {
    it("should throw error when ANTHROPIC_API_KEY is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => createLLM("clarity")).toThrow(
        "ANTHROPIC_API_KEY is required"
      );
    });

    it("should throw error when ANTHROPIC_API_KEY is empty string", () => {
      process.env.ANTHROPIC_API_KEY = "";

      expect(() => createLLM("clarity")).toThrow(
        "ANTHROPIC_API_KEY is required"
      );
    });

    it("should throw error when ANTHROPIC_API_KEY is only whitespace", () => {
      process.env.ANTHROPIC_API_KEY = "   ";

      expect(() => createLLM("clarity")).toThrow(
        "ANTHROPIC_API_KEY is required"
      );
    });

    it("should include helpful error message with Anthropic console link", () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => createLLM("clarity")).toThrow("console.anthropic.com");
    });

    it("should create LLM when API key is set", () => {
      process.env.ANTHROPIC_API_KEY = "test-key-123";

      // Should not throw
      const llm = createLLM("clarity");
      expect(llm).toBeDefined();
    });

    it("should cache LLM instances", () => {
      process.env.ANTHROPIC_API_KEY = "test-key-123";

      const llm1 = createLLM("clarity");
      const llm2 = createLLM("clarity");

      // Should return same instance from cache
      expect(llm1).toBe(llm2);
    });

    it("should create separate instances for different agent types", () => {
      process.env.ANTHROPIC_API_KEY = "test-key-123";

      const clarityLLM = createLLM("clarity");
      const validatorLLM = createLLM("validator");

      // Should be different instances
      expect(clarityLLM).not.toBe(validatorLLM);
    });
  });
});
