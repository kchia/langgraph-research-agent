import type { ResearchGraph } from "../graph/workflow.js";
import type { Command } from "@langchain/langgraph";
import { Logger } from "./logger.js";
import { validateInterruptData } from "../types/interrupt.js";
import {
  isGraphTaskArray,
  getInterruptValue,
  hasInterrupts,
  type GraphTask
} from "./graph-state-types.js";
import { executeWithTimeout } from "./timeout.js";

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
  return executeWithTimeout(
    async () => {
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

          // Handle errors from chain events
          if (event.event === "on_chain_error") {
            // Type-safe error extraction
            const errorData = event.data;
            let error: Error | null = null;
            let errorNode = currentNode;

            // Extract error from event data
            if (
              errorData &&
              typeof errorData === "object" &&
              "error" in errorData &&
              errorData.error instanceof Error
            ) {
              error = errorData.error;
            }

            // Try to get node name from event if available
            if (event.name && typeof event.name === "string") {
              errorNode = event.name;
            }

            // Call error callback if error was found
            if (error && callbacks.onError) {
              callbacks.onError(error, errorNode);
            } else if (callbacks.onError) {
              // If error not in expected format, create Error from event
              const fallbackError = new Error(
                `Chain error in node: ${errorNode}` +
                  (errorData ? ` - ${JSON.stringify(errorData)}` : "")
              );
              callbacks.onError(fallbackError, errorNode);
            }
          }
        }
      } catch (error) {
        logger.error("Stream error", {
          error: error instanceof Error ? error.message : String(error),
          node: currentNode
        });

        // Always call error callback if available, even for non-Error types
        if (callbacks.onError) {
          const errorToReport =
            error instanceof Error
              ? error
              : new Error(
                  `Unexpected error type: ${typeof error} - ${String(error)}`
                );
          callbacks.onError(errorToReport, currentNode);
        }

        throw error;
      }

      // Check for interrupts
      try {
        const state = await graph.getState(config);

        // Type-safe check for interrupts
        const tasks = state.tasks;
        if (!isGraphTaskArray(tasks)) {
          return {
            result: state.values as Record<string, unknown>,
            interrupted: false
          };
        }

        const firstTask: GraphTask | undefined = tasks[0];
        const hasInterrupt = firstTask && hasInterrupts(firstTask);

        if (hasInterrupt && firstTask) {
          const rawInterruptValue = getInterruptValue(firstTask);
          const interruptData = validateInterruptData(rawInterruptValue);

          if (interruptData) {
            return {
              result: state.values as Record<string, unknown>,
              interrupted: true,
              interruptData
            };
          } else {
            logger.warn("Invalid interrupt data structure", {
              rawValue: rawInterruptValue
            });
            // Return interrupted=false if data is invalid
            return {
              result: state.values as Record<string, unknown>,
              interrupted: false
            };
          }
        }

        return {
          result: state.values as Record<string, unknown>,
          interrupted: false
        };
      } catch (error) {
        logger.error("Error checking for interrupts", {
          error: error instanceof Error ? error.message : String(error)
        });

        // Call error callback if available
        if (callbacks.onError) {
          const errorToReport =
            error instanceof Error
              ? error
              : new Error(
                  `Error checking interrupts: ${typeof error} - ${String(
                    error
                  )}`
                );
          callbacks.onError(errorToReport, currentNode || "unknown");
        }

        // Re-throw to maintain error propagation
        throw error;
      }
    },
    undefined,
    "streamWithTokens"
  );
}
