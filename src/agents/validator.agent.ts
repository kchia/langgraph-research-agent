import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import {
  VALIDATOR_SYSTEM_PROMPT,
  buildValidatorUserPrompt
} from "../prompts/validator.prompts.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("validator-agent");

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
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });
  const structuredModel = (model as ChatAnthropic).withStructuredOutput(ValidatorOutputSchema);

  return async function validatorAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
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
    const findingsText = formatFindings(state.researchFindings);

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
      logger.error("Validation LLM failed", { error: String(error) });

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
