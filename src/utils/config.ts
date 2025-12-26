import { config as loadEnv } from "dotenv";

// Load .env file
loadEnv();

export interface AppConfig {
  anthropicApiKey: string | undefined;
  tavilyApiKey: string | undefined;
  dataSource: "mock" | "tavily" | "auto";
  logLevel: string;
  langsmithEnabled: boolean;
}

export function loadConfig(): AppConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    dataSource: (process.env.RESEARCH_DATA_SOURCE ??
      "auto") as AppConfig["dataSource"],
    logLevel: process.env.LOG_LEVEL ?? "info",
    langsmithEnabled: process.env.LANGCHAIN_TRACING_V2 === "true"
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.anthropicApiKey) {
    console.warn("Warning: ANTHROPIC_API_KEY not set. LLM features will fail.");
  }

  if (config.dataSource === "tavily" && !config.tavilyApiKey) {
    throw new Error("TAVILY_API_KEY required when RESEARCH_DATA_SOURCE=tavily");
  }
}
