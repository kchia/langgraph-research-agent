type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Generate a unique correlation ID for request tracking.
 * Uses a combination of timestamp and random string for uniqueness.
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Get correlation ID from graph config or generate a new one.
 */
export function getCorrelationId(config?: {
  configurable?: { correlation_id?: string };
}): string | undefined {
  return config?.configurable?.correlation_id;
}

export class Logger {
  private context: string;
  private minLevel: number;
  private correlationId?: string;

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId;
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

    const timestamp = new Date().toISOString();
    const correlationPart = this.correlationId
      ? ` [correlation_id:${this.correlationId}]`
      : "";
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${
      this.context
    }]${correlationPart}`;

    // Include correlation ID in structured data if provided
    const logData = this.correlationId
      ? { ...data, correlation_id: this.correlationId }
      : data;

    if (logData) {
      console.log(prefix, message, JSON.stringify(logData, null, 2));
    } else {
      console.log(prefix, message);
    }
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
