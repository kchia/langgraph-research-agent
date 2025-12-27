import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";
import { MAX_RESEARCH_ATTEMPTS, TOKEN_BUDGETS } from "../utils/constants.js";
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt
} from "../prompts/synthesis.prompts.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { getLLM } from "../utils/llm-factory.js";
import { TokenBudget } from "../utils/token-budget.js";
import { AgentNames } from "../graph/routes.js";

/**
 * Factory function to create Synthesis Agent with injectable LLM.
 */
export function createSynthesisAgent(llm?: BaseChatModel) {
  const model = getLLM("synthesis", llm);

  return async function synthesisAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const logger = createLoggerWithCorrelationId(
      "synthesis-agent",
      state.correlationId
    );
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
        currentAgent: AgentNames.SYNTHESIS
      };
    }

    // Determine confidence level
    const confidenceLevel = getConfidenceLevel(state);

    // Format findings for LLM
    let findingsText = formatFindings(state.researchFindings);

    // Apply token budget to findings if they're too long
    // Reserve tokens for system prompt, query, and response
    const budget = new TokenBudget();
    const maxFindingsTokens = TOKEN_BUDGETS.synthesis.findings;
    const findingsTokens = budget.estimateTokens(findingsText);

    if (findingsTokens > maxFindingsTokens) {
      logger.warn("Findings text exceeds token budget, truncating", {
        originalTokens: findingsTokens,
        maxTokens: maxFindingsTokens
      });
      findingsText = budget.truncateToFit(findingsText, maxFindingsTokens);
    }

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
        currentAgent: AgentNames.SYNTHESIS
      };
    } catch (error) {
      logger.error("Synthesis agent LLM call failed", {
        error: error instanceof Error ? error.message : String(error),
        company: state.detectedCompany,
        hasFindings: !!state.researchFindings
      });

      // Fallback: basic template response
      const fallbackSummary = generateFallbackSummary(state);
      return {
        finalSummary: fallbackSummary,
        messages: [new AIMessage(fallbackSummary)],
        currentAgent: AgentNames.SYNTHESIS
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
