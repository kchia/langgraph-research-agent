import type { ResearchGraph } from "../graph/workflow.js";
import type { Command } from "@langchain/langgraph";
import { Logger } from "./logger.js";

const logger = new Logger("token-streaming");

export interface TokenStreamCallbacks {
  onToken?: (token: string, nodeName: string) => void;
  onNodeStart?: (nodeName: string) => void;
  onNodeEnd?: (nodeName: string, output?: unknown) => void;
  onError?: (error: Error, nodeName: string) => void;
}

export interface TokenStreamResult {
  result: Record<string, unknown>;
  interrupted: boolean;
  interruptData?: {
    type: string;
    question: string;
    originalQuery: string;
    attempt: number;
  };
}

/**
 * Stream graph execution with LLM token streaming support.
 *
 * Provides real-time callbacks for:
 * - Individual LLM tokens as they're generated
 * - Node lifecycle events (start/end)
 * - Error handling
 *
 * @param graph - The compiled research graph
 * @param input - Input state or Command to resume
 * @param config - Graph configuration with thread_id
 * @param callbacks - Optional callbacks for streaming events
 */
export async function streamWithTokens(
  graph: ResearchGraph,
  input: Record<string, unknown> | Command<string>,
  config: { configurable: { thread_id: string } },
  callbacks: TokenStreamCallbacks = {}
): Promise<TokenStreamResult> {
  let currentNode = "";

  try {
    const stream = graph.streamEvents(input, {
      ...config,
      version: "v2"
    });

    for await (const event of stream) {
      // Node lifecycle events
      if (event.event === "on_chain_start") {
        const nodeName = event.name;
        if (
          nodeName &&
          !nodeName.startsWith("__") &&
          nodeName !== currentNode
        ) {
          currentNode = nodeName;
          callbacks.onNodeStart?.(nodeName);
        }
      }

      if (event.event === "on_chain_end" && event.name) {
        if (!event.name.startsWith("__")) {
          callbacks.onNodeEnd?.(event.name, event.data?.output);
        }
      }

      // LLM token streaming
      if (event.event === "on_llm_stream" && event.data?.chunk) {
        const chunk = event.data.chunk;
        const content = chunk.content;
        if (content && typeof content === "string") {
          callbacks.onToken?.(content, currentNode);
        }
      }

      // Handle errors
      if (event.event === "on_chain_error") {
        const errorData = event.data as { error?: Error } | undefined;
        if (errorData?.error) {
          callbacks.onError?.(errorData.error, currentNode);
        }
      }
    }
  } catch (error) {
    logger.error("Stream error", { error: String(error) });
    throw error;
  }

  // Check for interrupts
  const state = await graph.getState(config);
  const tasks = state.tasks as Array<{ interrupts?: Array<{ value: unknown }> }>;
  const hasInterrupt = tasks?.some(
    (t) => t.interrupts && t.interrupts.length > 0
  );

  if (hasInterrupt && tasks?.[0]?.interrupts?.[0]) {
    const interruptData = tasks[0].interrupts[0]
      .value as TokenStreamResult["interruptData"];
    return {
      result: state.values as Record<string, unknown>,
      interrupted: true,
      interruptData
    };
  }

  return {
    result: state.values as Record<string, unknown>,
    interrupted: false
  };
}
