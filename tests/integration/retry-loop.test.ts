import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import {
  ResearchStateAnnotation,
  type ResearchState
} from "../../src/graph/state.js";
import { researchRouter, validationRouter } from "../../src/graph/routers.js";
import { MAX_RESEARCH_ATTEMPTS } from "../../src/utils/constants.js";
import { AgentNames } from "../../src/graph/routes.js";

describe("Retry Loop Integration", () => {
  it("should retry research when validation fails", async () => {
    const attemptContexts: { attempt: number; feedback: string | null }[] = [];

    // Research agent that tracks attempts and provides low confidence initially
    const trackingResearchAgent = (
      state: ResearchState
    ): Partial<ResearchState> => {
      const attempt = state.researchAttempts + 1;
      attemptContexts.push({
        attempt,
        feedback: state.validationFeedback
      });

      // First attempt: low confidence. Second+: high confidence.
      const confidence = attempt === 1 ? 4 : 8;

      return {
        researchFindings: {
          company: "Test Co",
          recentNews: attempt === 1 ? null : "News found on retry",
          stockInfo: "Stock info",
          keyDevelopments: "Developments",
          sources: ["Test"],
          rawData: { attempt }
        },
        confidenceScore: confidence,
        researchAttempts: attempt,
        currentAgent: AgentNames.RESEARCH
      };
    };

    // Validator that fails first time
    let validationCalls = 0;
    const trackingValidator = (
      state: ResearchState
    ): Partial<ResearchState> => {
      validationCalls++;
      if (validationCalls === 1) {
        return {
          validationResult: "insufficient",
          validationFeedback: "Missing news data",
          currentAgent: AgentNames.VALIDATOR
        };
      }
      return {
        validationResult: "sufficient",
        validationFeedback: null,
        currentAgent: AgentNames.VALIDATOR
      };
    };

    const synthesisAgent = (state: ResearchState): Partial<ResearchState> => ({
      finalSummary: `Done after ${state.researchAttempts} attempts`,
      currentAgent: AgentNames.SYNTHESIS
    });

    const clarityAgent = (state: ResearchState): Partial<ResearchState> => ({
      clarityStatus: "clear",
      detectedCompany: "Test Co",
      currentAgent: AgentNames.CLARITY
    });

    const graph = new StateGraph(ResearchStateAnnotation)
      .addNode(AgentNames.CLARITY, clarityAgent)
      .addNode(AgentNames.RESEARCH, trackingResearchAgent)
      .addNode(AgentNames.VALIDATOR, trackingValidator)
      .addNode(AgentNames.SYNTHESIS, synthesisAgent)
      .addEdge(START, AgentNames.CLARITY)
      .addEdge(AgentNames.CLARITY, AgentNames.RESEARCH)
      .addConditionalEdges(AgentNames.RESEARCH, researchRouter, {
        [AgentNames.VALIDATOR]: AgentNames.VALIDATOR,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS
      })
      .addConditionalEdges(AgentNames.VALIDATOR, validationRouter, {
        [AgentNames.RESEARCH]: AgentNames.RESEARCH,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS
      })
      .addEdge(AgentNames.SYNTHESIS, END)
      .compile({ checkpointer: new MemorySaver() });

    const config = { configurable: { thread_id: "retry-test" } };

    const result = await graph.invoke(
      {
        messages: [new HumanMessage("Test query")],
        originalQuery: "Test query"
      },
      config
    );

    // Should have retried
    expect(result.researchAttempts).toBe(2);
    expect(attemptContexts).toHaveLength(2);

    // Second attempt should have received feedback
    expect(attemptContexts[1].feedback).toBe("Missing news data");
  });

  it("should stop at max attempts even if still insufficient", async () => {
    // Validator always returns insufficient
    const alwaysFailValidator = (): Partial<ResearchState> => ({
      validationResult: "insufficient",
      validationFeedback: "Always fails",
      currentAgent: AgentNames.VALIDATOR
    });

    let researchCalls = 0;
    const countingResearch = (state: ResearchState): Partial<ResearchState> => {
      researchCalls++;
      return {
        researchFindings: {
          company: "Test",
          recentNews: null,
          stockInfo: null,
          keyDevelopments: null,
          sources: [],
          rawData: {}
        },
        confidenceScore: 2, // Low, triggers validation
        researchAttempts: state.researchAttempts + 1,
        currentAgent: AgentNames.RESEARCH
      };
    };

    const graph = new StateGraph(ResearchStateAnnotation)
      .addNode(AgentNames.CLARITY, () => ({
        clarityStatus: "clear",
        detectedCompany: "Test",
        currentAgent: AgentNames.CLARITY
      }))
      .addNode(AgentNames.RESEARCH, countingResearch)
      .addNode(AgentNames.VALIDATOR, alwaysFailValidator)
      .addNode(AgentNames.SYNTHESIS, (state) => ({
        finalSummary: `Stopped after ${state.researchAttempts} attempts`,
        currentAgent: AgentNames.SYNTHESIS
      }))
      .addEdge(START, AgentNames.CLARITY)
      .addEdge(AgentNames.CLARITY, AgentNames.RESEARCH)
      .addConditionalEdges(AgentNames.RESEARCH, researchRouter, {
        [AgentNames.VALIDATOR]: AgentNames.VALIDATOR,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS
      })
      .addConditionalEdges(AgentNames.VALIDATOR, validationRouter, {
        [AgentNames.RESEARCH]: AgentNames.RESEARCH,
        [AgentNames.SYNTHESIS]: AgentNames.SYNTHESIS
      })
      .addEdge(AgentNames.SYNTHESIS, END)
      .compile({ checkpointer: new MemorySaver() });

    const result = await graph.invoke(
      {
        messages: [new HumanMessage("Test")],
        originalQuery: "Test"
      },
      { configurable: { thread_id: "max-attempts-test" } }
    );

    // Should have stopped at MAX_RESEARCH_ATTEMPTS
    expect(researchCalls).toBe(MAX_RESEARCH_ATTEMPTS);
    expect(result.researchAttempts).toBe(MAX_RESEARCH_ATTEMPTS);
    expect(result.finalSummary).toContain(String(MAX_RESEARCH_ATTEMPTS));
  });
});
