import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import { MAX_CLARIFICATION_ATTEMPTS } from "../utils/constants.js";
import { isFollowUpQuery, isCancelRequest } from "../utils/patterns.js";
import {
  CLARITY_SYSTEM_PROMPT,
  buildClarityUserPrompt
} from "../prompts/clarity.prompts.js";
import { Logger, createLoggerWithCorrelationId } from "../utils/logger.js";
import { getLLM, supportsStructuredOutput } from "../utils/llm-factory.js";
import { TokenBudget } from "../utils/token-budget.js";
import {
  summarizeMessages,
  buildConversationContext
} from "../utils/message-summarization.js";
import { normalizeCompanyName } from "../data/company-normalization.js";

// Logger is created per-request with correlation ID from state

// Schema for structured LLM output
const ClarityOutputSchema = z.object({
  is_clear: z.boolean(),
  detected_company: z.string().nullable(),
  clarification_needed: z.string().nullable(),
  reasoning: z.string()
});

type ClarityOutput = z.infer<typeof ClarityOutputSchema>;

/**
 * Normalize company name to full form for consistency.
 * Maps common company name variations to their canonical forms.
 */
// Company normalization is now handled by the configurable module
// See src/data/company-normalization.ts

/**
 * Factory function to create Clarity Agent with injectable LLM.
 */
export function createClarityAgent(llm?: BaseChatModel) {
  const model = getLLM("clarity", llm);

  // Runtime check for structured output support
  if (!supportsStructuredOutput(model)) {
    const modelName = model.constructor.name;
    throw new Error(
      `Model ${modelName} does not support structured output. ` +
        `The clarity agent requires a model with withStructuredOutput() method. ` +
        `Please use a compatible model like ChatAnthropic.`
    );
  }

  // After runtime check, safe to use withStructuredOutput
  // Type assertion needed because TypeScript can't infer the exact return type
  const structuredModel = (model as ChatAnthropic).withStructuredOutput(
    ClarityOutputSchema
  );

  return async function clarityAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    // Create logger with correlation ID from state
    const logger = createLoggerWithCorrelationId(
      "clarity-agent",
      state.correlationId
    );

    logger.info("Clarity analysis started", {
      query: state.originalQuery,
      previousCompany: state.detectedCompany,
      clarificationResponse: state.clarificationResponse,
      attempt: state.clarificationAttempts
    });

    // Check max clarification attempts FIRST to prevent infinite loops
    // (e.g., repeated empty queries)
    if (state.clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
      logger.warn("Max clarification attempts reached, forcing proceed");
      const fallbackCompany =
        state.detectedCompany ?? extractBestGuess(state.originalQuery ?? "");
      return {
        clarityStatus: "clear",
        detectedCompany: fallbackCompany
          ? normalizeCompanyName(fallbackCompany)
          : null,
        currentAgent: "clarity"
      };
    }

    // Handle empty query
    // NOTE: We increment clarificationAttempts here because we're requesting clarification.
    // The Interrupt node does NOT increment - it only reads this value.
    if (!state.originalQuery?.trim()) {
      return {
        clarityStatus: "needs_clarification",
        clarificationQuestion:
          "Hello! What would you like to know about a company?",
        clarificationAttempts: state.clarificationAttempts + 1,
        currentAgent: "clarity"
      };
    }

    // Handle cancel request
    if (isCancelRequest(state.originalQuery)) {
      logger.info("Cancel request detected");
      return {
        clarityStatus: "clear",
        detectedCompany: null,
        finalSummary:
          "No problem! Let me know if you'd like to research anything else.",
        currentAgent: "clarity"
      };
    }

    // Quick check for follow-up with existing company
    if (isFollowUpQuery(state.originalQuery, !!state.detectedCompany)) {
      logger.info("Follow-up detected, using existing company", {
        company: state.detectedCompany
      });
      return {
        clarityStatus: "clear",
        currentAgent: "clarity"
      };
    }

    // Use LLM for analysis
    try {
      // Check if we need to summarize messages (only if conversation is very long)
      let conversationSummary = state.conversationSummary;
      if (!conversationSummary && state.messages.length > 10) {
        // Only attempt summarization if we have many messages and no summary yet
        conversationSummary = await summarizeMessages(state.messages);
      }

      // Build conversation context using summary if available
      const maxContextTokens = 4000;
      const conversationContext = buildConversationContext(
        state.messages,
        conversationSummary,
        maxContextTokens
      );

      const response: ClarityOutput = await structuredModel.invoke([
        { role: "system", content: CLARITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildClarityUserPrompt(
            state.originalQuery,
            state.detectedCompany,
            conversationContext,
            state.clarificationResponse
          )
        }
      ]);

      logger.info("LLM analysis complete", {
        isClear: response.is_clear,
        company: response.detected_company,
        reasoning: response.reasoning
      });

      // If company detected, proceed (regardless of is_clear flag)
      if (response.detected_company) {
        const normalizedCompany = normalizeCompanyName(
          response.detected_company
        );
        const result: Partial<ResearchState> = {
          clarityStatus: "clear",
          detectedCompany: normalizedCompany,
          clarificationQuestion: null,
          currentAgent: "clarity"
        };
        // Only include conversationSummary if it was created
        if (conversationSummary) {
          result.conversationSummary = conversationSummary;
        }
        return result;
      } else {
        // No company detected - use helper for proceed/clarify decision
        const result = handleNoCompanyDetected(
          logger,
          state.clarificationAttempts,
          response.clarification_needed ??
            "Which company would you like to know about?",
          "info"
        );
        // Include conversation summary if created
        if (conversationSummary) {
          return {
            ...result,
            conversationSummary
          };
        }
        return result;
      }
    } catch (error) {
      logger.error("Clarity agent LLM call failed", {
        error: error instanceof Error ? error.message : String(error),
        query: state.originalQuery
      });

      // Fallback: try to extract company from query
      const bestGuess = extractBestGuess(state.originalQuery);
      if (bestGuess) {
        const normalizedCompany = normalizeCompanyName(bestGuess);
        return {
          clarityStatus: "clear",
          detectedCompany: normalizedCompany,
          currentAgent: "clarity"
        };
      }

      // No company extracted - use helper for proceed/clarify decision
      return handleNoCompanyDetected(
        logger,
        state.clarificationAttempts,
        "I had trouble understanding. Which company are you asking about?",
        "warn"
      );
    }
  };
}

/**
 * Extract best guess company name from query (fallback when LLM fails).
 * Returns the base company name (will be normalized by caller).
 */
function extractBestGuess(query: string): string | null {
  const knownCompanies = [
    "apple",
    "tesla",
    "microsoft",
    "amazon",
    "google",
    "alphabet"
  ];
  const lowerQuery = query.toLowerCase();

  for (const company of knownCompanies) {
    if (lowerQuery.includes(company)) {
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
  }
  return null;
}

/**
 * Handle the case when no company is detected.
 * If clarification was already attempted, proceed gracefully.
 * Otherwise, ask for clarification.
 *
 * NOTE: This function increments clarificationAttempts when requesting
 * clarification. The Interrupt node does NOT increment - it only reads
 * the value set by the Clarity Agent.
 */
function handleNoCompanyDetected(
  logger: Logger,
  clarificationAttempts: number,
  clarificationQuestion: string,
  logLevel: "info" | "warn" = "info"
): Partial<ResearchState> {
  if (clarificationAttempts > 0) {
    logger[logLevel](
      "No company detected after clarification attempt, proceeding gracefully"
    );
    return {
      clarityStatus: "clear",
      detectedCompany: null,
      clarificationQuestion: null,
      currentAgent: "clarity"
    };
  }
  // First attempt - ask for clarification
  // Increment clarificationAttempts here (Clarity Agent responsibility)
  return {
    clarityStatus: "needs_clarification",
    clarificationQuestion,
    clarificationAttempts: clarificationAttempts + 1,
    currentAgent: "clarity"
  };
}

// Default export for graph (uses default LLM)
export const clarityAgent = createClarityAgent();
