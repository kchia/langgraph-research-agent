import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";

const logger = new Logger("llm-factory");

export type AgentType = "clarity" | "validator" | "synthesis";

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// Cache for LLM instances to avoid recreating them
const modelCache: Map<AgentType, BaseChatModel> = new Map();

/**
 * Create an LLM instance for a specific agent type.
 *
 * Uses cached instances when available to avoid recreating models.
 * Model can be configured per-agent via environment variables.
 */
export function createLLM(agentType: AgentType): BaseChatModel {
  // Check cache first
  if (modelCache.has(agentType)) {
    return modelCache.get(agentType)!;
  }

  const config = loadConfig();
  const modelName = config.models?.[agentType] ?? DEFAULT_MODEL;

  // Validate API key before creating LLM
  if (!config.anthropicApiKey || config.anthropicApiKey.trim() === "") {
    throw new Error(
      `ANTHROPIC_API_KEY is required to create LLM instances. ` +
        `Please set the ANTHROPIC_API_KEY environment variable. ` +
        `Get your API key from: https://console.anthropic.com/`
    );
  }

  logger.info("Creating LLM instance", { agentType, model: modelName });

  const llm = new ChatAnthropic({
    model: modelName,
    anthropicApiKey: config.anthropicApiKey
  });

  modelCache.set(agentType, llm);
  return llm;
}

/**
 * Clear the LLM cache.
 * Useful for testing or when config changes.
 */
export function clearLLMCache(): void {
  modelCache.clear();
}

/**
 * Get an LLM for a specific agent, or use a provided instance.
 * Useful for dependency injection in tests.
 */
export function getLLM(
  agentType: AgentType,
  providedLLM?: BaseChatModel
): BaseChatModel {
  return providedLLM ?? createLLM(agentType);
}

/**
 * Type guard to check if a model supports structured output.
 * Models that support structured output have a withStructuredOutput method.
 *
 * After this check passes, it's safe to call withStructuredOutput on the model.
 */
export function supportsStructuredOutput(
  model: BaseChatModel
): model is BaseChatModel & {
  withStructuredOutput: <T>(schema: T) => {
    invoke: (messages: unknown[]) => Promise<unknown>;
  };
} {
  return (
    typeof model === "object" &&
    model !== null &&
    "withStructuredOutput" in model &&
    typeof (model as { withStructuredOutput?: unknown })
      .withStructuredOutput === "function"
  );
}
