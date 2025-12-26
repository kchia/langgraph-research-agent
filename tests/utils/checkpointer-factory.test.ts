import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import {
  createCheckpointer,
  getCheckpointerConfigFromEnv,
  type CheckpointerConfig
} from "../../src/utils/checkpointer-factory.js";

describe("checkpointer-factory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createCheckpointer", () => {
    it("should create memory checkpointer by default", async () => {
      const checkpointer = await createCheckpointer();
      expect(checkpointer).toBeInstanceOf(MemorySaver);
    });

    it("should create memory checkpointer when type is memory", async () => {
      const checkpointer = await createCheckpointer({ type: "memory" });
      expect(checkpointer).toBeInstanceOf(MemorySaver);
    });

    it("should throw error for invalid checkpointer type", async () => {
      // TypeScript won't allow this, but test runtime behavior
      const invalidConfig = { type: "invalid" as "memory" };
      // This should work at runtime but TypeScript will complain
      // We're testing that the function handles it gracefully
      await expect(
        createCheckpointer(invalidConfig as CheckpointerConfig)
      ).rejects.toThrow();
    });
  });

  describe("getCheckpointerConfigFromEnv", () => {
    it("should return memory config by default", () => {
      delete process.env.CHECKPOINTER_TYPE;
      const config = getCheckpointerConfigFromEnv();
      expect(config.type).toBe("memory");
    });

    it("should return memory config when CHECKPOINTER_TYPE is memory", () => {
      process.env.CHECKPOINTER_TYPE = "memory";
      const config = getCheckpointerConfigFromEnv();
      expect(config.type).toBe("memory");
    });

    it("should return sqlite config when CHECKPOINTER_TYPE is sqlite", () => {
      process.env.CHECKPOINTER_TYPE = "sqlite";
      const config = getCheckpointerConfigFromEnv();
      expect(config.type).toBe("sqlite");
    });

    it("should include sqlite path when provided", () => {
      process.env.CHECKPOINTER_TYPE = "sqlite";
      process.env.CHECKPOINTER_SQLITE_PATH = "/tmp/test.db";
      const config = getCheckpointerConfigFromEnv();
      expect(config.type).toBe("sqlite");
      expect(config.sqlitePath).toBe("/tmp/test.db");
    });

    it("should throw error for invalid CHECKPOINTER_TYPE", () => {
      process.env.CHECKPOINTER_TYPE = "invalid";
      expect(() => getCheckpointerConfigFromEnv()).toThrow(
        'Invalid CHECKPOINTER_TYPE: "invalid"'
      );
    });

    it("should throw error for empty string CHECKPOINTER_TYPE", () => {
      process.env.CHECKPOINTER_TYPE = "";
      // Empty string will be treated as invalid
      expect(() => getCheckpointerConfigFromEnv()).toThrow();
    });
  });
});
