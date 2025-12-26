type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export class Logger {
  private context: string;
  private minLevel: number;

  constructor(context: string) {
    this.context = context;
    const envLevel = (process.env.LOG_LEVEL ?? "info") as LogLevel;
    this.minLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
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
