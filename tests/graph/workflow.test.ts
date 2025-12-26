import { describe, it, expect } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { compileResearchGraph } from "../../src/graph/workflow.js";

describe("workflow", () => {
  describe("compileResearchGraph", () => {
    it("should compile graph with valid checkpointer", () => {
      const checkpointer = new MemorySaver();
      const graph = compileResearchGraph(checkpointer);
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });

    it("should throw error for null checkpointer", () => {
      expect(() => {
        compileResearchGraph(null as unknown as typeof checkpointer);
      }).toThrow("Checkpointer is required");
    });

    it("should throw error for undefined checkpointer", () => {
      expect(() => {
        compileResearchGraph(undefined as unknown as typeof checkpointer);
      }).toThrow("Checkpointer is required");
    });

    it("should include helpful error message", () => {
      expect(() => {
        compileResearchGraph(null as unknown as typeof checkpointer);
      }).toThrow("BaseCheckpointSaver");
    });
  });
});
