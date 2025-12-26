import { config as loadEnv } from "dotenv";

// Load .env file
loadEnv();

export interface ModelConfig {
  clarity: string;
  validator: string;
  synthesis: string;
}

export interface AppConfig {
  anthropicApiKey: string | undefined;
  tavilyApiKey: string | undefined;
  dataSource: "mock" | "tavily" | "auto";
  logLevel: string;
  langsmithEnabled: boolean;
  models?: Partial<ModelConfig>;
}

export function loadConfig(): AppConfig {
  // Build models config from env vars if provided
  const models: Partial<ModelConfig> = {};
  if (process.env.CLARITY_MODEL) models.clarity = process.env.CLARITY_MODEL;
  if (process.env.VALIDATOR_MODEL)
    models.validator = process.env.VALIDATOR_MODEL;
  if (process.env.SYNTHESIS_MODEL)
    models.synthesis = process.env.SYNTHESIS_MODEL;

  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    dataSource: (process.env.RESEARCH_DATA_SOURCE ??
      "auto") as AppConfig["dataSource"],
    logLevel: process.env.LOG_LEVEL ?? "info",
    langsmithEnabled: process.env.LANGCHAIN_TRACING_V2 === "true",
    models: Object.keys(models).length > 0 ? models : undefined
  };
}

export function validateConfig(config: AppConfig): void {
  // Note: API key validation happens in llm-factory.ts when LLM is created
  // This allows the app to start even without API key (for testing/config validation)
  // but will fail fast when trying to use LLM features
  if (!config.anthropicApiKey || config.anthropicApiKey.trim() === "") {
    console.warn(
      "Warning: ANTHROPIC_API_KEY not set. LLM features will fail at runtime."
    );
  }

  if (config.dataSource === "tavily" && !config.tavilyApiKey) {
    throw new Error("TAVILY_API_KEY required when RESEARCH_DATA_SOURCE=tavily");
  }

  if (config.langsmithEnabled) {
    if (!process.env.LANGCHAIN_API_KEY) {
      console.warn(
        "Warning: LANGCHAIN_TRACING_V2=true but LANGCHAIN_API_KEY not set"
      );
    } else {
      console.log(
        "LangSmith tracing enabled for project:",
        process.env.LANGCHAIN_PROJECT ?? "default"
      );
    }
  }
}
