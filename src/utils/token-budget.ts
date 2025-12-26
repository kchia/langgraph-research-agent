import { Logger } from "./logger.js";

const logger = new Logger("token-budget");

// Approximate tokens per character for Claude models
const CHARS_PER_TOKEN = 4;

/**
 * Token budget manager for tracking and limiting context size.
 */
export class TokenBudget {
  private maxTokens: number;
  private usedTokens: number = 0;

  constructor(maxTokens: number = 100000) {
    this.maxTokens = maxTokens;
  }

  /**
   * Estimate token count for text.
   * Uses character-based approximation (accurate within ~10%).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Add tokens to usage counter.
   */
  addUsage(tokens: number): void {
    this.usedTokens += tokens;
  }

  /**
   * Get remaining token budget.
   */
  getRemainingBudget(): number {
    return Math.max(0, this.maxTokens - this.usedTokens);
  }

  /**
   * Check if budget has been exceeded.
   */
  isOverBudget(): boolean {
    return this.usedTokens > this.maxTokens;
  }

  /**
   * Reset usage counter.
   */
  reset(): void {
    this.usedTokens = 0;
  }

  /**
   * Truncate text to fit within token limit.
   */
  truncateToFit(text: string, maxTokens: number): string {
    const currentTokens = this.estimateTokens(text);
    if (currentTokens <= maxTokens) return text;

    const targetChars = maxTokens * CHARS_PER_TOKEN;
    const truncated = text.slice(0, targetChars);

    logger.debug("Text truncated", {
      originalTokens: currentTokens,
      targetTokens: maxTokens,
      originalChars: text.length,
      truncatedChars: truncated.length
    });

    return truncated + "...[truncated]";
  }

  /**
   * Select messages from array to fit within token budget.
   * Prioritizes most recent messages.
   */
  selectMessagesWithinBudget<T extends { content: unknown }>(
    messages: T[],
    maxTokens: number
  ): T[] {
    const selected: T[] = [];
    let tokenCount = 0;

    // Process from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.estimateTokens(
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content)
      );

      if (tokenCount + msgTokens <= maxTokens) {
        selected.unshift(msg);
        tokenCount += msgTokens;
      } else {
        break;
      }
    }

    logger.debug("Messages selected within budget", {
      totalMessages: messages.length,
      selectedMessages: selected.length,
      tokenCount,
      maxTokens
    });

    return selected;
  }
}

// Default budget for conversation context
export const conversationBudget = new TokenBudget(100000);
