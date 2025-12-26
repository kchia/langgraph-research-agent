import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Logger,
  generateCorrelationId,
  createLoggerWithCorrelationId
} from "../../src/utils/logger.js";

describe("logger correlation IDs", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("generateCorrelationId", () => {
    it("should generate unique correlation IDs", () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
    });

    it("should generate IDs with expected format", () => {
      const id = generateCorrelationId();
      // Format: timestamp-random (e.g., "lxyz123-abc456")
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe("Logger with correlation ID", () => {
    it("should include correlation ID in log output", () => {
      const correlationId = "test-correlation-123";
      const logger = new Logger("test-context", correlationId);

      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).toContain(correlationId);
    });

    it("should include correlation ID in structured data", () => {
      const correlationId = "test-correlation-456";
      const logger = new Logger("test-context", correlationId);

      logger.info("Test message", { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const dataCall = consoleLogSpy.mock.calls[0][2] as string;
      const parsed = JSON.parse(dataCall);
      expect(parsed.correlation_id).toBe(correlationId);
      expect(parsed.key).toBe("value");
    });

    it("should work without correlation ID", () => {
      const logger = new Logger("test-context");

      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain("correlation_id");
    });

    it("should allow setting correlation ID after creation", () => {
      const logger = new Logger("test-context");
      const correlationId = "test-correlation-789";

      logger.setCorrelationId(correlationId);
      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).toContain(correlationId);
    });
  });

  describe("createLoggerWithCorrelationId", () => {
    it("should create logger with correlation ID", () => {
      const correlationId = "test-correlation-999";
      const logger = createLoggerWithCorrelationId(
        "test-context",
        correlationId
      );

      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).toContain(correlationId);
    });

    it("should handle null correlation ID", () => {
      const logger = createLoggerWithCorrelationId("test-context", null);

      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain("correlation_id");
    });

    it("should handle undefined correlation ID", () => {
      const logger = createLoggerWithCorrelationId("test-context", undefined);

      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain("correlation_id");
    });
  });
});
