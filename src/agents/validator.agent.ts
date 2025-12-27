import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ResearchState } from "../graph/state.js";
import {
  VALIDATOR_SYSTEM_PROMPT,
  buildValidatorUserPrompt
} from "../prompts/validator.prompts.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { getLLM, supportsStructuredOutput } from "../utils/llm-factory.js";
import { TokenBudget } from "../utils/token-budget.js";
import { TOKEN_BUDGETS } from "../utils/constants.js";
import { AgentNames } from "../graph/routes.js";
import { formatFindings } from "../utils/findings-formatter.js";

const ValidatorOutputSchema = z.object({
  is_sufficient: z.boolean(),
  feedback: z.string().nullable(),
  reasoning: z.string()
});

type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

/**
 * Factory function to create Validator Agent with injectable LLM.
 */
export function createValidatorAgent(llm?: BaseChatModel) {
  const model = getLLM("validator", llm);

  // Runtime check for structured output support
  if (!supportsStructuredOutput(model)) {
    const modelName = model.constructor.name;
    throw new Error(
      `Model ${modelName} does not support structured output. ` +
        `The validator agent requires a model with withStructuredOutput() method. ` +
        `Please use a compatible model like ChatAnthropic.`
    );
  }

  // After runtime check, type guard narrows to model with withStructuredOutput
  const structuredModel = model.withStructuredOutput(ValidatorOutputSchema);

  return async function validatorAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const logger = createLoggerWithCorrelationId(
      "validator-agent",
      state.correlationId
    );
    logger.info("Validation started", {
      company: state.detectedCompany,
      confidence: state.confidenceScore,
      attempt: state.researchAttempts
    });

    // No findings = definitely insufficient
    if (!state.researchFindings) {
      logger.info("No findings to validate");
      return {
        validationResult: "insufficient",
        validationFeedback:
          "No research data found. Try searching with different terms.",
        currentAgent: AgentNames.VALIDATOR
      };
    }

    // Format findings for LLM
    let findingsText = formatFindings(state.researchFindings, {
      includeCompany: true,
      includeSources: true
    });

    // Apply token budget to findings if they're too long
    // Reserve tokens for system prompt, query, and response structure
    const budget = new TokenBudget();
    const maxFindingsTokens = TOKEN_BUDGETS.validator.findings;
    const findingsTokens = budget.estimateTokens(findingsText);

    if (findingsTokens > maxFindingsTokens) {
      logger.warn("Findings text exceeds token budget, truncating", {
        originalTokens: findingsTokens,
        maxTokens: maxFindingsTokens
      });
      findingsText = budget.truncateToFit(findingsText, maxFindingsTokens);
    }

    try {
      const rawResponse = await structuredModel.invoke([
        { role: "system", content: VALIDATOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildValidatorUserPrompt(
            state.originalQuery,
            findingsText,
            state.confidenceScore
          )
        }
      ]);
      const response = ValidatorOutputSchema.parse(rawResponse);

      logger.info("Validation complete", {
        sufficient: response.is_sufficient,
        reasoning: response.reasoning
      });

      return {
        validationResult: response.is_sufficient
          ? "sufficient"
          : "insufficient",
        validationFeedback: response.feedback,
        currentAgent: AgentNames.VALIDATOR
      };
    } catch (error) {
      logger.error("Validator agent LLM call failed", {
        error: error instanceof Error ? error.message : String(error),
        company: state.detectedCompany,
        hasFindings: !!state.researchFindings
      });

      // Fallback: rule-based validation aligned with LLM evaluation criteria
      const fallbackResult = ruleBasedValidation(state.researchFindings);

      return {
        validationResult: fallbackResult.result,
        validationFeedback: fallbackResult.feedback,
        currentAgent: AgentNames.VALIDATOR
      };
    }
  };
}

/**
 * Rule-based validation fallback aligned with LLM evaluation criteria.
 *
 * Criteria (matching what the LLM evaluates):
 * 1. Must have either recent news OR key developments (not all required)
 * 2. Should have at least 2 sources for verification
 * 3. Stock info is optional but contributes to sufficiency
 */
function ruleBasedValidation(findings: ResearchState["researchFindings"]): {
  result: "sufficient" | "insufficient";
  feedback: string | null;
} {
  if (!findings) {
    return {
      result: "insufficient",
      feedback: "No research findings available"
    };
  }

  const issues: string[] = [];

  // Criterion 1: Must have recent news OR key developments
  const hasContextualInfo = !!(findings.recentNews || findings.keyDevelopments);
  if (!hasContextualInfo) {
    issues.push("Missing both recent news and key developments");
  }

  // Criterion 2: Should have at least 2 sources
  const hasSufficientSources = findings.sources && findings.sources.length >= 2;
  if (!hasSufficientSources) {
    issues.push("Insufficient source verification (need at least 2 sources)");
  }

  // Stock info is optional but noted
  const hasStockInfo = !!findings.stockInfo;

  // Sufficient if we have contextual info AND sources
  if (hasContextualInfo && hasSufficientSources) {
    return {
      result: "sufficient",
      feedback: hasStockInfo
        ? null
        : "Findings adequate; stock data unavailable"
    };
  }

  return {
    result: "insufficient",
    feedback: issues.join("; ")
  };
}

// Default export for graph
export const validatorAgent = createValidatorAgent();
