import type { ResearchGraph } from "../graph/workflow.js";
import type { Command } from "@langchain/langgraph";
import { validateInterruptDataWithErrors } from "../types/interrupt.js";
import { Logger } from "./logger.js";
import {
  isGraphTaskArray,
  getInterruptValue,
  hasInterrupts,
  type GraphTask
} from "./graph-state-types.js";
import { executeWithTimeout } from "./timeout.js";

const logger = new Logger("streaming");

export interface StreamResult {
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
 * Default progress display for CLI.
 */
export function displayProgress(node: string): void {
  // Skip internal/system nodes
  if (node.startsWith("__")) {
    return;
  }

  const icons: Record<string, string> = {
    clarity: "🔍 Analyzing query...",
    research: "📚 Researching...",
    validator: "✅ Validating findings...",
    synthesis: "📝 Generating summary..."
  };

  const message = icons[node] ?? `⚙️ ${node}...`;
  console.log(message);
}

/**
 * Stream graph execution with interrupt support.
 * After streaming completes, checks graph state for pending interrupts.
 */
export async function streamWithInterruptSupport(
  graph: ResearchGraph,
  input: Record<string, unknown> | Command<string>,
  config: { configurable: { thread_id: string } },
  onProgress: (node: string) => void
): Promise<StreamResult> {
  return executeWithTimeout(
    async () => {
      const stream = await graph.stream(input, {
        ...config,
        streamMode: "updates"
      });

      for await (const update of stream) {
        const entries = Object.entries(update);
        if (entries.length === 0) continue;

        const [nodeName] = entries[0];
        if (nodeName && nodeName !== "__start__") {
          onProgress(nodeName);
        }
      }

      // Check state after stream for interrupt
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
        const validationResult = validateInterruptDataWithErrors(rawInterruptValue);

        if (validationResult.success && validationResult.data) {
          return {
            result: state.values as Record<string, unknown>,
            interrupted: true,
            interruptData: validationResult.data
          };
        } else {
          // Log detailed validation errors to aid debugging
          logger.warn("Invalid interrupt data structure", {
            rawValue: rawInterruptValue,
            rawValueType: typeof rawInterruptValue,
            hasType: rawInterruptValue && typeof rawInterruptValue === "object" && "type" in rawInterruptValue,
            validationErrors: validationResult.errors
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
    },
    undefined,
    "streamWithInterruptSupport"
  );
}
