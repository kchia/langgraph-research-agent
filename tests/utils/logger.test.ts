import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    const UUID_REGEX = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

    it("should generate unique correlation IDs", () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      // Both IDs should be valid UUIDs
      expect(id1).toMatch(UUID_REGEX);
      expect(id2).toMatch(UUID_REGEX);
      // IDs should be different
      expect(id1).not.toBe(id2);
    });

    it("should generate IDs with expected format", () => {
      const id = generateCorrelationId();
      // Format: UUID (e.g., "ce8af133-1d74-4b7e-9753-cab6a0dd55ee")
      expect(id).toMatch(UUID_REGEX);
      expect(id.length).toBe(36); // UUID length with dashes
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
