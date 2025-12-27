import { getEncoding, type Tiktoken } from "js-tiktoken";
import { Logger } from "./logger.js";

const logger = new Logger("token-budget");

/**
 * Cached tiktoken encoder instance.
 * Uses cl100k_base encoding which is closest to Claude's tokenization.
 * Lazy-initialized on first use.
 */
let cachedEncoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!cachedEncoder) {
    // cl100k_base is used by GPT-4 and is closest to Claude's tokenization
    cachedEncoder = getEncoding("cl100k_base");
  }
  return cachedEncoder;
}

/**
 * Fallback ratio for edge cases where tiktoken fails.
 * Conservative estimate to avoid exceeding limits.
 */
const FALLBACK_CHARS_PER_TOKEN = 3.5;

/**
 * Regex pattern for sentence endings (period, exclamation, question followed by whitespace).
 */
const SENTENCE_ENDINGS_PATTERN = /[.!?]\s+/g;

/**
 * Find the last sentence boundary position within a search area.
 *
 * @param text - The text to search in
 * @param searchStart - Start position for backward search
 * @returns Position after the last sentence boundary, or null if none found
 */
function findLastSentenceBoundary(
  text: string,
  searchStart: number
): number | null {
  const searchText = text.slice(searchStart);
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  // Create a new regex instance for each search to avoid lastIndex issues
  const regex = new RegExp(SENTENCE_ENDINGS_PATTERN);
  while ((match = regex.exec(searchText)) !== null) {
    lastMatch = match;
  }

  if (lastMatch && lastMatch.index !== undefined) {
    return searchStart + lastMatch.index + lastMatch[0].length;
  }
  return null;
}

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
   * Uses tiktoken (cl100k_base) for accurate counting (~98% accuracy for Claude).
   * Falls back to character-based estimation if encoding fails.
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    try {
      const encoder = getEncoder();
      return encoder.encode(text).length;
    } catch (error) {
      // Fallback to character-based estimation
      logger.debug("Tiktoken encoding failed, using fallback", {
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length
      });
      return Math.ceil(text.length / FALLBACK_CHARS_PER_TOKEN);
    }
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
   * Uses tiktoken for accurate token-based truncation.
   * Attempts to truncate at sentence boundaries when possible to avoid mid-word cuts.
   */
  truncateToFit(text: string, maxTokens: number): string {
    if (!text) return text;

    const currentTokens = this.estimateTokens(text);
    if (currentTokens <= maxTokens) return text;

    try {
      const encoder = getEncoder();
      const tokens = encoder.encode(text);
      const truncatedTokens = tokens.slice(0, maxTokens);
      let truncated = encoder.decode(truncatedTokens);

      // Try to find a sentence boundary near the truncation point
      // Search backwards from truncation point (within 20% of text length)
      const truncatedLength = truncated.length;
      const searchStart = Math.max(
        0,
        truncatedLength - Math.floor(truncatedLength * 0.2)
      );

      const boundaryPos = findLastSentenceBoundary(truncated, searchStart);

      // If we found a sentence boundary, truncate there instead
      if (boundaryPos !== null) {
        // Verify this position is still within token budget
        const boundaryText = text.slice(0, boundaryPos);
        const boundaryTokens = this.estimateTokens(boundaryText);

        if (boundaryTokens <= maxTokens) {
          truncated = boundaryText;
          logger.debug("Text truncated at sentence boundary", {
            originalTokens: currentTokens,
            targetTokens: maxTokens,
            actualTruncatedTokens: boundaryTokens,
            truncatedAt: boundaryPos
          });
        } else {
          logger.debug(
            "Sentence boundary exceeds token budget, using token-based truncation",
            {
              originalTokens: currentTokens,
              targetTokens: maxTokens,
              boundaryTokens
            }
          );
        }
      }

      logger.debug("Text truncated", {
        originalTokens: currentTokens,
        targetTokens: maxTokens,
        actualTruncatedTokens: this.estimateTokens(truncated)
      });

      return truncated + "...[truncated]";
    } catch (error) {
      // Fallback to character-based truncation
      logger.debug("Tiktoken truncation failed, using fallback", {
        error: error instanceof Error ? error.message : String(error)
      });
      const targetChars = Math.floor(maxTokens * FALLBACK_CHARS_PER_TOKEN);
      let truncated = text.slice(0, targetChars);

      // Try to find sentence boundary in fallback mode too
      const searchStart = Math.max(
        0,
        targetChars - Math.floor(targetChars * 0.2)
      );

      const boundaryPos = findLastSentenceBoundary(truncated, searchStart);

      if (boundaryPos !== null && boundaryPos <= targetChars) {
        truncated = text.slice(0, boundaryPos);
      }

      return truncated + "...[truncated]";
    }
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
