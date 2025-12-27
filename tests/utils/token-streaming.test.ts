import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { streamWithTokens } from "../../src/utils/token-streaming.js";
import { compileResearchGraph } from "../../src/graph/workflow.js";
import { createNewQueryInput } from "../../src/utils/state-helpers.js";

describe.skip("token-streaming error handling", () => {
  let graph: ReturnType<typeof compileResearchGraph>;

  beforeEach(() => {
    graph = compileResearchGraph(new MemorySaver());
  });

  afterEach(async () => {
    // Ensure all async operations complete and streams are closed
    // Multiple event loop ticks to ensure all pending operations complete
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("should call onError callback for stream errors", async () => {
    const onErrorSpy = vi.fn();
    const callbacks = {
      onError: onErrorSpy
    };

    // Create a mock graph that throws during iteration
    const mockStream = async function* () {
      throw new Error("Stream failed");
      yield; // Unreachable but needed for type
    };

    const mockGraph = {
      streamEvents: vi.fn().mockReturnValue(mockStream())
    } as any;

    try {
      await streamWithTokens(
        mockGraph,
        createNewQueryInput("test"),
        { configurable: { thread_id: "test-error" } },
        callbacks
      );
      expect.fail("Should have thrown");
    } catch (error) {
      // Expected to throw
    }

    // Verify error callback was called
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onErrorSpy.mock.calls[0][0].message).toContain("Stream failed");
  });

  it("should call onError callback for non-Error types", async () => {
    const onErrorSpy = vi.fn();
    const callbacks = {
      onError: onErrorSpy
    };

    // Create a mock stream that throws a non-Error
    const mockStream = async function* () {
      throw "string error";
      yield; // Unreachable but needed for type
    };

    const mockGraph = {
      streamEvents: vi.fn().mockReturnValue(mockStream())
    } as any;

    try {
      await streamWithTokens(
        mockGraph,
        createNewQueryInput("test"),
        { configurable: { thread_id: "test-error-2" } },
        callbacks
      );
      expect.fail("Should have thrown");
    } catch (error) {
      // Expected to throw
    }

    // Verify error callback was called with Error wrapper
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onErrorSpy.mock.calls[0][0].message).toContain(
      "Unexpected error type"
    );
  });

  it("should call onError callback when getState fails", async () => {
    const onErrorSpy = vi.fn();
    const onNodeStartSpy = vi.fn();
    const callbacks = {
      onError: onErrorSpy,
      onNodeStart: onNodeStartSpy
    };

    // Create a graph that streams successfully but getState fails
    const mockStream = async function* () {
      yield {
        event: "on_chain_start",
        name: "clarity"
      };
    };

    const mockGraph = {
      streamEvents: vi.fn().mockReturnValue(mockStream()),
      getState: vi.fn().mockRejectedValue(new Error("getState failed"))
    } as any;

    try {
      await streamWithTokens(
        mockGraph,
        createNewQueryInput("test"),
        { configurable: { thread_id: "test-error-3" } },
        callbacks
      );
      expect.fail("Should have thrown");
    } catch (error) {
      // Expected to throw
    }

    // Verify error callback was called
    expect(onErrorSpy).toHaveBeenCalledTimes(1);
    expect(onErrorSpy.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onErrorSpy.mock.calls[0][0].message).toContain("getState failed");
  });

  it("should not throw if onError callback is not provided", async () => {
    const mockStream = async function* () {
      throw new Error("Stream failed");
      yield; // Unreachable but needed for type
    };

    const mockGraph = {
      streamEvents: vi.fn().mockReturnValue(mockStream())
    } as any;

    // Should still throw even without error callback (error propagation)
    await expect(
      streamWithTokens(
        mockGraph,
        createNewQueryInput("test"),
        { configurable: { thread_id: "test-error-4" } },
        {}
      )
    ).rejects.toThrow("Stream failed");
  });
});
