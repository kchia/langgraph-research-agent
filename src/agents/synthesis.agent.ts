import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";
import { MAX_RESEARCH_ATTEMPTS } from "../utils/constants.js";
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt
} from "../prompts/synthesis.prompts.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("synthesis-agent");

/**
 * Factory function to create Synthesis Agent with injectable LLM.
 */
export function createSynthesisAgent(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });

  return async function synthesisAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    logger.info("Synthesis started", {
      company: state.detectedCompany,
      confidence: state.confidenceScore,
      hasFindings: !!state.researchFindings,
      validationResult: state.validationResult
    });

    // Case 1: No data at all
    if (!state.researchFindings || !state.researchFindings.company) {
      const noDataSummary = generateNoDataResponse(state);
      return {
        finalSummary: noDataSummary,
        messages: [new AIMessage(noDataSummary)],
        currentAgent: "synthesis"
      };
    }

    // Determine confidence level
    const confidenceLevel = getConfidenceLevel(state);

    // Format findings for LLM
    const findingsText = formatFindings(state.researchFindings);

    try {
      const response = await model.invoke([
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildSynthesisUserPrompt(
            state.originalQuery,
            state.researchFindings.company,
            findingsText,
            confidenceLevel
          )
        }
      ]);

      const summary =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      // Add confidence prefix if needed
      const prefixedSummary = addConfidencePrefix(
        summary,
        confidenceLevel,
        state
      );

      logger.info("Synthesis complete", {
        confidenceLevel,
        summaryLength: prefixedSummary.length
      });

      return {
        finalSummary: prefixedSummary,
        messages: [new AIMessage(prefixedSummary)],
        currentAgent: "synthesis"
      };
    } catch (error) {
      logger.error("Synthesis LLM failed", { error: String(error) });

      // Fallback: basic template response
      const fallbackSummary = generateFallbackSummary(state);
      return {
        finalSummary: fallbackSummary,
        messages: [new AIMessage(fallbackSummary)],
        currentAgent: "synthesis"
      };
    }
  };
}

function getConfidenceLevel(state: ResearchState): "high" | "medium" | "low" {
  if (state.confidenceScore >= 8) return "high";
  if (state.confidenceScore >= 5) return "medium";
  return "low";
}

function addConfidencePrefix(
  summary: string,
  level: "high" | "medium" | "low",
  state: ResearchState
): string {
  if (level === "high") return summary;

  if (level === "low") {
    return `**Note**: Based on limited available information:\n\n${summary}`;
  }

  // Medium confidence - check if max attempts reached
  if (
    state.validationResult === "insufficient" &&
    state.researchAttempts >= MAX_RESEARCH_ATTEMPTS
  ) {
    return `*I found some information, but couldn't verify all details:*\n\n${summary}`;
  }

  return summary;
}

function generateNoDataResponse(state: ResearchState): string {
  const query = state.detectedCompany ?? state.originalQuery;
  return `I couldn't find specific information about "${query}".

This might be because:
- The company name wasn't recognized in my sources
- Limited public data is available

Would you like to:
- Try a different spelling or the full company name?
- Ask about a related company?`;
}

function generateFallbackSummary(state: ResearchState): string {
  const findings = state.researchFindings;
  if (!findings) return generateNoDataResponse(state);

  const parts = [`Here's what I found about ${findings.company}:`];

  if (findings.recentNews) {
    parts.push(`\n**Recent News**: ${findings.recentNews}`);
  }
  if (findings.stockInfo) {
    parts.push(`\n**Financial**: ${findings.stockInfo}`);
  }
  if (findings.keyDevelopments) {
    parts.push(`\n**Key Developments**: ${findings.keyDevelopments}`);
  }

  return parts.join("\n");
}

function formatFindings(findings: ResearchState["researchFindings"]): string {
  if (!findings) return "No findings";

  return `Recent News: ${findings.recentNews ?? "Not available"}
Stock/Financial Info: ${findings.stockInfo ?? "Not available"}
Key Developments: ${findings.keyDevelopments ?? "Not available"}`;
}

// Default export for graph
export const synthesisAgent = createSynthesisAgent();
