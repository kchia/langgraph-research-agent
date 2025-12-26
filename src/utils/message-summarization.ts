import type { BaseMessage } from "@langchain/core/messages";
import { TokenBudget } from "./token-budget.js";
import { Logger } from "./logger.js";
import { getLLM } from "./llm-factory.js";

const logger = new Logger("message-summarization");

/**
 * Threshold for when to summarize messages (in tokens).
 * Only summarize if conversation exceeds this threshold.
 */
const SUMMARIZATION_THRESHOLD = 8000; // tokens

/**
 * Maximum tokens to use for recent messages after summarization.
 */
const MAX_RECENT_MESSAGES_TOKENS = 2000;

/**
 * Summarize old conversation messages using LLM.
 *
 * This is called when conversation history is too long to fit in token budget.
 * Summarizes older messages while keeping recent ones intact.
 *
 * @param messages - All conversation messages
 * @param summaryPrompt - Optional custom prompt for summarization
 * @returns Summary string or null if summarization not needed/failed
 */
export async function summarizeMessages(
  messages: BaseMessage[],
  summaryPrompt?: string
): Promise<string | null> {
  if (messages.length === 0) {
    return null;
  }

  const budget = new TokenBudget();
  const totalTokens = budget.estimateTokens(
    messages.map((m) => String(m.content)).join("\n")
  );

  // Only summarize if we exceed threshold
  if (totalTokens < SUMMARIZATION_THRESHOLD) {
    logger.debug("Messages within threshold, no summarization needed", {
      totalTokens,
      threshold: SUMMARIZATION_THRESHOLD
    });
    return null;
  }

  logger.info("Summarizing conversation messages", {
    messageCount: messages.length,
    totalTokens
  });

  try {
    // Split messages into old (to summarize) and recent (to keep)
    const recentMessages = budget.selectMessagesWithinBudget(
      messages.map((m) => ({
        content: `${m._getType()}: ${m.content}`,
        original: m
      })),
      MAX_RECENT_MESSAGES_TOKENS
    );

    const recentCount = recentMessages.length;
    const oldMessages = messages.slice(0, messages.length - recentCount);

    if (oldMessages.length === 0) {
      logger.debug("No old messages to summarize");
      return null;
    }

    // Format old messages for summarization
    const oldMessagesText = oldMessages
      .map((m) => `${m._getType()}: ${m.content}`)
      .join("\n");

    const prompt =
      summaryPrompt ??
      `Summarize the following conversation history. Focus on key information, decisions, and context that would be useful for continuing the conversation. Keep it concise but informative.

Conversation history:
${oldMessagesText}

Summary:`;

    const model = getLLM("synthesis");
    const response = await model.invoke([
      {
        role: "user",
        content: prompt
      }
    ]);

    const summary =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    logger.info("Message summarization complete", {
      oldMessageCount: oldMessages.length,
      recentMessageCount: recentCount,
      summaryLength: summary.length
    });

    return summary;
  } catch (error) {
    logger.error("Failed to summarize messages", {
      error: error instanceof Error ? error.message : String(error)
    });
    // Return null on error - we'll just use message selection instead
    return null;
  }
}

/**
 * Build conversation context from messages and summary.
 *
 * If summary exists, uses summary + recent messages.
 * Otherwise, uses selected messages within budget.
 *
 * @param messages - All conversation messages
 * @param summary - Optional conversation summary
 * @param maxTokens - Maximum tokens for context
 * @returns Formatted conversation context string
 */
export function buildConversationContext(
  messages: BaseMessage[],
  summary: string | null,
  maxTokens: number
): string {
  const budget = new TokenBudget();

  if (summary) {
    // Use summary + recent messages
    const summaryTokens = budget.estimateTokens(summary);
    const remainingTokens = Math.max(0, maxTokens - summaryTokens);

    const recentMessages = budget.selectMessagesWithinBudget(
      messages.map((m) => ({
        content: `${m._getType()}: ${m.content}`,
        original: m
      })),
      remainingTokens
    );

    const recentContext = recentMessages.map((m) => m.content).join("\n");

    return `[Previous conversation summary]\n${summary}\n\n[Recent messages]\n${recentContext}`;
  } else {
    // Use selected messages within budget
    const selectedMessages = budget.selectMessagesWithinBudget(
      messages.map((m) => ({
        content: `${m._getType()}: ${m.content}`,
        original: m
      })),
      maxTokens
    );

    return selectedMessages.map((m) => m.content).join("\n");
  }
}
