import type { ResearchGraph } from "../graph/workflow.js";
import type { Command } from "@langchain/langgraph";

export interface StreamUpdate {
  node: string;
  data: Record<string, unknown>;
}

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
 * Stream graph execution with progress callbacks.
 */
export async function streamWithProgress(
  graph: ResearchGraph,
  input: Record<string, unknown>,
  config: { configurable: { thread_id: string } },
  onProgress: (node: string) => void
): Promise<Record<string, unknown>> {
  const stream = await graph.stream(input, {
    ...config,
    streamMode: "updates"
  });

  let lastResult: Record<string, unknown> = {};

  for await (const update of stream) {
    const entries = Object.entries(update);
    if (entries.length === 0) continue;

    const [nodeName, nodeOutput] = entries[0];
    if (nodeName && nodeName !== "__start__") {
      onProgress(nodeName);
      lastResult = {
        ...lastResult,
        ...(nodeOutput as Record<string, unknown>)
      };
    }
  }

  return lastResult;
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
  const hasInterrupt = state.tasks?.some(
    (t: { interrupts?: unknown[] }) => t.interrupts && t.interrupts.length > 0
  );

  if (hasInterrupt) {
    const interruptData = (state.tasks[0] as { interrupts?: { value: unknown }[] })
      ?.interrupts?.[0]?.value as StreamResult["interruptData"];
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
