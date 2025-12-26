import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../../src/graph/state.js";

export function createBaseState(query: string): Partial<ResearchState> {
  return {
    messages: [new HumanMessage(query)],
    originalQuery: query
  };
}
