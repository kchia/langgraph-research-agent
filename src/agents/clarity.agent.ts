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
import { Logger } from "../utils/logger.js";

const logger = new Logger("clarity-agent");

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
function normalizeCompanyName(company: string | null): string | null {
  if (!company) return null;

  const normalized = company.trim();
  const lower = normalized.toLowerCase();

  // Map common variations to full company names
  const companyMap: Record<string, string> = {
    apple: "Apple Inc.",
    tesla: "Tesla, Inc.",
    microsoft: "Microsoft Corporation",
    amazon: "Amazon.com, Inc.",
    google: "Alphabet Inc.",
    alphabet: "Alphabet Inc.",
    meta: "Meta Platforms, Inc.",
    facebook: "Meta Platforms, Inc.",
    nvidia: "NVIDIA Corporation",
    netflix: "Netflix, Inc."
  };

  // Check exact match first
  if (companyMap[lower]) {
    return companyMap[lower];
  }

  // Check if the normalized name already contains common suffixes
  if (
    normalized.includes("Inc.") ||
    normalized.includes("Corporation") ||
    normalized.includes("Corp.") ||
    normalized.includes("LLC") ||
    normalized.includes("Ltd.")
  ) {
    return normalized;
  }

  // Check partial matches (e.g., "Apple" -> "Apple Inc.")
  for (const [key, value] of Object.entries(companyMap)) {
    if (
      lower === key ||
      lower.startsWith(key + " ") ||
      lower.endsWith(" " + key)
    ) {
      return value;
    }
  }

  // Return as-is if no normalization found
  return normalized;
}

/**
 * Factory function to create Clarity Agent with injectable LLM.
 */
export function createClarityAgent(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });
  // Type assertion needed because BaseChatModel is a union type and TypeScript
  // cannot determine which withStructuredOutput signature to use
  const structuredModel = (model as ChatAnthropic).withStructuredOutput(
    ClarityOutputSchema
  );

  return async function clarityAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    logger.info("Clarity analysis started", {
      query: state.originalQuery,
      previousCompany: state.detectedCompany,
      attempt: state.clarificationAttempts
    });

    // Handle empty query
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

    // Check max clarification attempts
    if (state.clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
      logger.warn("Max clarification attempts reached, forcing proceed");
      const fallbackCompany =
        state.detectedCompany ?? extractBestGuess(state.originalQuery);
      return {
        clarityStatus: "clear",
        detectedCompany: fallbackCompany
          ? normalizeCompanyName(fallbackCompany)
          : null,
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
      const conversationContext = state.messages
        .slice(-6)
        .map((m) => `${m._getType()}: ${m.content}`)
        .join("\n");

      const response: ClarityOutput = await structuredModel.invoke([
        { role: "system", content: CLARITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildClarityUserPrompt(
            state.originalQuery,
            state.detectedCompany,
            conversationContext
          )
        }
      ]);

      logger.info("LLM analysis complete", {
        isClear: response.is_clear,
        company: response.detected_company,
        reasoning: response.reasoning
      });

      if (response.is_clear && response.detected_company) {
        const normalizedCompany = normalizeCompanyName(
          response.detected_company
        );
        return {
          clarityStatus: "clear",
          detectedCompany: normalizedCompany,
          clarificationQuestion: null,
          currentAgent: "clarity"
        };
      } else {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion:
            response.clarification_needed ??
            "Which company would you like to know about?",
          clarificationAttempts: state.clarificationAttempts + 1,
          currentAgent: "clarity"
        };
      }
    } catch (error) {
      logger.error("LLM call failed", { error: String(error) });

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

      return {
        clarityStatus: "needs_clarification",
        clarificationQuestion:
          "I had trouble understanding. Which company are you asking about?",
        clarificationAttempts: state.clarificationAttempts + 1,
        currentAgent: "clarity"
      };
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

// Default export for graph (uses default LLM)
export const clarityAgent = createClarityAgent();
