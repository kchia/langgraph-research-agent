import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  summarizeMessages,
  buildConversationContext
} from "../../src/utils/message-summarization.js";
import { getLLM } from "../../src/utils/llm-factory.js";

// Mock the LLM factory
vi.mock("../../src/utils/llm-factory.js", () => ({
  getLLM: vi.fn()
}));

describe("message-summarization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("summarizeMessages", () => {
    it("should return null for empty messages", async () => {
      const result = await summarizeMessages([]);
      expect(result).toBeNull();
    });

    it("should return null if messages are below threshold", async () => {
      const messages = [
        new HumanMessage("Tell me about Apple"),
        new AIMessage("Apple is a tech company")
      ];

      const result = await summarizeMessages(messages);
      expect(result).toBeNull();
    });

    it("should attempt summarization for long conversations", async () => {
      // Create messages with enough text to exceed 8000 token threshold
      // ~4 chars per token, so need ~32000 characters
      const messages: Array<HumanMessage | AIMessage> = [];
      const longText = "This is a very long message. ".repeat(200); // ~6000 chars per message
      for (let i = 0; i < 10; i++) {
        messages.push(new HumanMessage(`${longText} Question ${i}`));
        messages.push(new AIMessage(`${longText} Answer ${i}`));
      }

      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: "Summary: Multiple questions about various companies"
        })
      };

      vi.mocked(getLLM).mockReturnValue(mockLLM as any);

      const result = await summarizeMessages(messages);

      expect(result).toBeTruthy();
      expect(result).toContain("Summary");
      expect(getLLM).toHaveBeenCalledWith("synthesis");
    });

    it("should return null on summarization error", async () => {
      // Create messages with enough text to exceed threshold
      const messages: Array<HumanMessage | AIMessage> = [];
      const longText = "This is a very long message. ".repeat(200);
      for (let i = 0; i < 10; i++) {
        messages.push(new HumanMessage(`${longText} Question ${i}`));
      }

      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error("LLM failed"))
      };

      vi.mocked(getLLM).mockReturnValue(mockLLM as any);

      const result = await summarizeMessages(messages);

      expect(result).toBeNull();
    });
  });

  describe("buildConversationContext", () => {
    it("should use summary + recent messages when summary exists", () => {
      const messages = [
        new HumanMessage("Question 1"),
        new AIMessage("Answer 1"),
        new HumanMessage("Question 2"),
        new AIMessage("Answer 2")
      ];

      const summary = "Previous conversation about companies";
      const context = buildConversationContext(messages, summary, 1000);

      expect(context).toContain("[Previous conversation summary]");
      expect(context).toContain(summary);
      expect(context).toContain("[Recent messages]");
      expect(context).toContain("Question 2");
    });

    it("should use only selected messages when no summary", () => {
      const messages = [
        new HumanMessage("Question 1"),
        new AIMessage("Answer 1"),
        new HumanMessage("Question 2"),
        new AIMessage("Answer 2")
      ];

      const context = buildConversationContext(messages, null, 100);

      expect(context).not.toContain("[Previous conversation summary]");
      expect(context).toContain("human: Question");
      expect(context).toContain("ai: Answer");
    });

    it("should respect token budget when building context", () => {
      const messages: Array<HumanMessage | AIMessage> = [];
      for (let i = 0; i < 20; i++) {
        messages.push(
          new HumanMessage(
            `Very long question ${i} with lots of text`.repeat(10)
          )
        );
      }

      const context = buildConversationContext(messages, null, 500);

      // Should be truncated to fit budget
      expect(context.length).toBeLessThan(5000); // Rough token estimate
    });

    it("should include summary in context even with limited tokens", () => {
      const messages = [
        new HumanMessage("Question 1"),
        new AIMessage("Answer 1")
      ];

      const summary = "Previous conversation summary";
      const context = buildConversationContext(messages, summary, 100);

      expect(context).toContain(summary);
    });
  });
});
