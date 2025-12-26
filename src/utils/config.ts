import { z } from "zod";
import { config as loadEnv } from "dotenv";

// Load .env file
loadEnv();

/**
 * Zod schema for model configuration.
 */
const ModelConfigSchema = z.object({
  clarity: z.string(),
  validator: z.string(),
  synthesis: z.string()
});

/**
 * Zod schema for application configuration.
 */
const AppConfigSchema = z
  .object({
    anthropicApiKey: z.string().optional(),
    tavilyApiKey: z.string().optional(),
    dataSource: z.enum(["mock", "tavily", "auto"]).default("auto"),
    logLevel: z.string().default("info"),
    langsmithEnabled: z.boolean().default(false),
    models: z
      .object({
        clarity: z.string().optional(),
        validator: z.string().optional(),
        synthesis: z.string().optional()
      })
      .optional()
  })
  .refine((data) => data.dataSource !== "tavily" || data.tavilyApiKey, {
    message: "TAVILY_API_KEY required when RESEARCH_DATA_SOURCE=tavily",
    path: ["tavilyApiKey"]
  });

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadConfig(): AppConfig {
  // Build models config from env vars if provided
  const models: Partial<z.infer<typeof ModelConfigSchema>> = {};
  if (process.env.CLARITY_MODEL) models.clarity = process.env.CLARITY_MODEL;
  if (process.env.VALIDATOR_MODEL)
    models.validator = process.env.VALIDATOR_MODEL;
  if (process.env.SYNTHESIS_MODEL)
    models.synthesis = process.env.SYNTHESIS_MODEL;

  const rawConfig = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    dataSource: process.env.RESEARCH_DATA_SOURCE ?? "auto",
    logLevel: process.env.LOG_LEVEL ?? "info",
    langsmithEnabled: process.env.LANGCHAIN_TRACING_V2 === "true",
    models: Object.keys(models).length > 0 ? models : undefined
  };

  // Parse and validate with Zod
  const result = AppConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new Error(
      `Invalid configuration: ${result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }

  return result.data;
}

export function validateConfig(config: AppConfig): void {
  // Validate with Zod schema
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Configuration validation failed: ${result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }

  // Note: API key validation happens in llm-factory.ts when LLM is created
  // This allows the app to start even without API key (for testing/config validation)
  // but will fail fast when trying to use LLM features
  if (!config.anthropicApiKey || config.anthropicApiKey.trim() === "") {
    console.warn(
      "Warning: ANTHROPIC_API_KEY not set. LLM features will fail at runtime."
    );
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
