import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRetryableError, withRetry } from "../../src/utils/retry.js";

describe("isRetryableError", () => {
  describe("structured error properties", () => {
    it("should detect HTTP 429 status as retryable", () => {
      const error = Object.assign(new Error("Rate limited"), { status: 429 });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect HTTP 502 status as retryable", () => {
      const error = Object.assign(new Error("Bad gateway"), { status: 502 });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect HTTP 503 status as retryable", () => {
      const error = Object.assign(new Error("Service unavailable"), {
        status: 503
      });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect HTTP 504 status as retryable", () => {
      const error = Object.assign(new Error("Gateway timeout"), { status: 504 });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should not retry HTTP 400 errors", () => {
      const error = Object.assign(new Error("Bad request"), { status: 400 });
      expect(isRetryableError(error)).toBe(false);
    });

    it("should not retry HTTP 401 errors", () => {
      const error = Object.assign(new Error("Unauthorized"), { status: 401 });
      expect(isRetryableError(error)).toBe(false);
    });

    it("should not retry HTTP 404 errors", () => {
      const error = Object.assign(new Error("Not found"), { status: 404 });
      expect(isRetryableError(error)).toBe(false);
    });

    it("should detect ECONNRESET code as retryable", () => {
      const error = Object.assign(new Error("Connection reset"), {
        code: "ECONNRESET"
      });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect ETIMEDOUT code as retryable", () => {
      const error = Object.assign(new Error("Timed out"), {
        code: "ETIMEDOUT"
      });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect ENOTFOUND code as retryable", () => {
      const error = Object.assign(new Error("DNS lookup failed"), {
        code: "ENOTFOUND"
      });
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect ECONNREFUSED code as retryable", () => {
      const error = Object.assign(new Error("Connection refused"), {
        code: "ECONNREFUSED"
      });
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe("message-based fallback", () => {
    it("should detect timeout in message as retryable", () => {
      expect(isRetryableError(new Error("Request timeout"))).toBe(true);
      expect(isRetryableError(new Error("TIMEOUT"))).toBe(true);
    });

    it("should detect rate limit in message as retryable", () => {
      expect(isRetryableError(new Error("Rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("Too many requests"))).toBe(true);
    });

    it("should detect 429 in message as retryable", () => {
      expect(isRetryableError(new Error("Error 429"))).toBe(true);
    });

    it("should detect network errors in message as retryable", () => {
      expect(isRetryableError(new Error("Network error"))).toBe(true);
    });

    it("should not retry generic errors", () => {
      expect(isRetryableError(new Error("Something went wrong"))).toBe(false);
      expect(isRetryableError(new Error("Invalid input"))).toBe(false);
    });

    it("should not retry non-Error objects", () => {
      expect(isRetryableError("string error")).toBe(false);
      expect(isRetryableError({ message: "object error" })).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn, { retries: 3 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("success");

    const result = await withRetry(fn, {
      retries: 3,
      minTimeout: 10,
      maxTimeout: 10
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should abort immediately on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid input"));

    await expect(
      withRetry(fn, { retries: 3, minTimeout: 10 })
    ).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should throw after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));

    await expect(
      withRetry(fn, { retries: 2, minTimeout: 10, maxTimeout: 10 })
    ).rejects.toThrow("timeout");

    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("should use provided correlation ID for logging", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("success");

    await withRetry(fn, {
      retries: 3,
      minTimeout: 10,
      maxTimeout: 10,
      correlationId: "test-123",
      operation: "test-op"
    });

    const logCalls = consoleSpy.mock.calls.flat().join(" ");
    expect(logCalls).toContain("test-123");

    consoleSpy.mockRestore();
  });

  it("should respect minTimeout and maxTimeout options", async () => {
    const startTime = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("success");

    await withRetry(fn, { retries: 1, minTimeout: 50, maxTimeout: 100 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});
