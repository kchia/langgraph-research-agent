import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withTimeout,
  executeWithTimeout,
  GraphTimeoutError,
  getGraphTimeout,
  DEFAULT_GRAPH_TIMEOUT_MS
} from "../../src/utils/timeout.js";

describe("timeout utility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Ensure all timers are cleared and real timers are restored
    vi.clearAllTimers();
    vi.useRealTimers();
    delete process.env.GRAPH_TIMEOUT_MS;
    // Give event loop a chance to process any pending timers
    await new Promise((resolve) => setImmediate(resolve));
  });

  describe("withTimeout", () => {
    it("should resolve if promise completes before timeout", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("success"), 100);
      });

      const resultPromise = withTimeout(promise, 500);
      vi.advanceTimersByTime(100);

      await expect(resultPromise).resolves.toBe("success");
    });

    it("should reject with GraphTimeoutError if timeout exceeded", async () => {
      const promise = new Promise<string>(() => {
        // Never resolves
      });

      const resultPromise = withTimeout(promise, 100);
      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow(GraphTimeoutError);
      await expect(resultPromise).rejects.toThrow("timed out");
    });

    it("should use custom timeout message", async () => {
      const promise = new Promise<string>(() => {
        // Never resolves
      });

      const resultPromise = withTimeout(promise, 100, "Custom timeout message");
      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow("Custom timeout message");
    });

    it("should propagate promise rejection", async () => {
      const promise = Promise.reject(new Error("Original error"));

      const resultPromise = withTimeout(promise, 100);
      vi.advanceTimersByTime(50);

      await expect(resultPromise).rejects.toThrow("Original error");
    });

    it("should clear timeout if promise resolves", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("success"), 50);
      });

      const resultPromise = withTimeout(promise, 100);
      vi.advanceTimersByTime(50);

      await expect(resultPromise).resolves.toBe("success");

      // Advance past timeout - should not throw
      vi.advanceTimersByTime(100);
      await expect(resultPromise).resolves.toBe("success");
    });
  });

  describe("executeWithTimeout", () => {
    it("should execute operation with default timeout", async () => {
      const operation = vi.fn().mockResolvedValue("result");

      const resultPromise = executeWithTimeout(operation);
      vi.advanceTimersByTime(100);

      await expect(resultPromise).resolves.toBe("result");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should execute operation with custom timeout", async () => {
      const operation = vi.fn().mockResolvedValue("result");

      const resultPromise = executeWithTimeout(operation, 200);
      vi.advanceTimersByTime(100);

      await expect(resultPromise).resolves.toBe("result");
    });

    it("should timeout if operation takes too long", async () => {
      const operation = vi.fn(
        () =>
          new Promise<string>(() => {
            // Never resolves
          })
      );

      const resultPromise = executeWithTimeout(
        operation,
        100,
        "test operation"
      );
      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow(GraphTimeoutError);
      await expect(resultPromise).rejects.toThrow("test operation timed out");
    });
  });

  describe("getGraphTimeout", () => {
    it("should return default timeout if env var not set", () => {
      delete process.env.GRAPH_TIMEOUT_MS;
      expect(getGraphTimeout()).toBe(DEFAULT_GRAPH_TIMEOUT_MS);
    });

    it("should return parsed env var if valid", () => {
      process.env.GRAPH_TIMEOUT_MS = "60000";
      expect(getGraphTimeout()).toBe(60000);
    });

    it("should return default if env var is invalid", () => {
      process.env.GRAPH_TIMEOUT_MS = "invalid";
      expect(getGraphTimeout()).toBe(DEFAULT_GRAPH_TIMEOUT_MS);
    });

    it("should return default if env var is negative", () => {
      process.env.GRAPH_TIMEOUT_MS = "-100";
      expect(getGraphTimeout()).toBe(DEFAULT_GRAPH_TIMEOUT_MS);
    });

    it("should return default if env var is zero", () => {
      process.env.GRAPH_TIMEOUT_MS = "0";
      expect(getGraphTimeout()).toBe(DEFAULT_GRAPH_TIMEOUT_MS);
    });
  });

  describe("GraphTimeoutError", () => {
    it("should have correct error properties", () => {
      const error = new GraphTimeoutError(5000);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("GraphTimeoutError");
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toContain("5000");
    });

    it("should use custom message if provided", () => {
      const error = new GraphTimeoutError(5000, "Custom message");
      expect(error.message).toBe("Custom message");
      expect(error.timeoutMs).toBe(5000);
    });
  });
});
