import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import {
  VALIDATOR_SYSTEM_PROMPT,
  buildValidatorUserPrompt
} from "../prompts/validator.prompts.js";
import { createLoggerWithCorrelationId } from "../utils/logger.js";
import { getLLM, supportsStructuredOutput } from "../utils/llm-factory.js";
import { TokenBudget } from "../utils/token-budget.js";
import { TOKEN_BUDGETS } from "../utils/constants.js";

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

  // After runtime check, safe to use withStructuredOutput
  // Type assertion needed because TypeScript can't infer the exact return type
  const structuredModel = (model as ChatAnthropic).withStructuredOutput(
    ValidatorOutputSchema
  );

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
        currentAgent: "validator"
      };
    }

    // Format findings for LLM
    let findingsText = formatFindings(state.researchFindings);

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
      const response: ValidatorOutput = await structuredModel.invoke([
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

      logger.info("Validation complete", {
        sufficient: response.is_sufficient,
        reasoning: response.reasoning
      });

      return {
        validationResult: response.is_sufficient
          ? "sufficient"
          : "insufficient",
        validationFeedback: response.feedback,
        currentAgent: "validator"
      };
    } catch (error) {
      logger.error("Validator agent LLM call failed", {
        error: error instanceof Error ? error.message : String(error),
        company: state.detectedCompany,
        hasFindings: !!state.researchFindings
      });

      // Fallback: simple rule-based validation
      const hasAllFields = !!(
        state.researchFindings.recentNews &&
        state.researchFindings.stockInfo &&
        state.researchFindings.keyDevelopments
      );

      return {
        validationResult: hasAllFields ? "sufficient" : "insufficient",
        validationFeedback: hasAllFields
          ? null
          : "Some research fields are incomplete.",
        currentAgent: "validator"
      };
    }
  };
}

function formatFindings(findings: ResearchState["researchFindings"]): string {
  if (!findings) return "No findings";

  return `Company: ${findings.company}
Recent News: ${findings.recentNews ?? "Not available"}
Stock Info: ${findings.stockInfo ?? "Not available"}
Key Developments: ${findings.keyDevelopments ?? "Not available"}
Sources: ${findings.sources.join(", ") || "None"}`;
}

// Default export for graph
export const validatorAgent = createValidatorAgent();
