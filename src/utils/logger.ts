export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Interface for log transports.
 * Implement this to customize where logs are sent (console, file, cloud service).
 */
export interface LogTransport {
  /**
   * Write a log entry.
   *
   * @param level - Log severity level
   * @param context - Logger context (e.g., "clarity-agent")
   * @param message - Log message
   * @param data - Optional structured data
   * @param correlationId - Optional correlation ID for request tracing
   */
  log(
    level: LogLevel,
    context: string,
    message: string,
    data?: Record<string, unknown>,
    correlationId?: string
  ): void;
}

/**
 * Default console transport.
 * Outputs logs to console with timestamp, level, and context.
 */
class ConsoleTransport implements LogTransport {
  log(
    level: LogLevel,
    context: string,
    message: string,
    data?: Record<string, unknown>,
    correlationId?: string
  ): void {
    const timestamp = new Date().toISOString();
    const correlationPart = correlationId
      ? ` [correlation_id:${correlationId}]`
      : "";
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]${correlationPart}`;

    if (data && Object.keys(data).length > 0) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }
}

// Default transport instance
const defaultTransport = new ConsoleTransport();

/**
 * Generate a unique correlation ID for request tracking.
 * Uses crypto.randomUUID for guaranteed uniqueness and cryptographic security.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export class Logger {
  private context: string;
  private minLevel: number;
  private correlationId?: string;
  private transport: LogTransport;

  constructor(context: string, correlationId?: string, transport?: LogTransport) {
    this.context = context;
    this.correlationId = correlationId;
    this.transport = transport ?? defaultTransport;
    const envLevel = (process.env.LOG_LEVEL ?? "info") as LogLevel;
    this.minLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
  }

  /**
   * Set correlation ID for this logger instance.
   * Useful when correlation ID becomes available after logger creation.
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    // Include correlation ID in structured data if provided
    const logData = this.correlationId
      ? { ...data, correlation_id: this.correlationId }
      : data;

    this.transport.log(level, this.context, message, logData, this.correlationId);
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log("error", message, data);
  }
}

/**
 * Create a logger with correlation ID from state.
 * This is a convenience function for agents to get a logger
 * that includes the correlation ID from the current state.
 *
 * @param context - Logger context (e.g., "clarity-agent")
 * @param correlationId - Optional correlation ID from state
 * @returns Logger instance with correlation ID set
 */
export function createLoggerWithCorrelationId(
  context: string,
  correlationId?: string | null
): Logger {
  return new Logger(context, correlationId ?? undefined);
}

/**
 * Create a logger with a custom transport.
 * Use this for production logging to services like CloudWatch, Datadog, etc.
 *
 * @param context - Logger context (e.g., "clarity-agent")
 * @param correlationId - Optional correlation ID
 * @param transport - Custom log transport implementation
 * @returns Logger instance with custom transport
 */
export function createLoggerWithTransport(
  context: string,
  correlationId: string | null,
  transport: LogTransport
): Logger {
  return new Logger(context, correlationId ?? undefined, transport);
}

// Export ConsoleTransport for extension
export { ConsoleTransport };
