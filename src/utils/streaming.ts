import type { ResearchGraph } from "../graph/workflow.js";

export interface StreamUpdate {
  node: string;
  data: Record<string, unknown>;
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
  const icons: Record<string, string> = {
    clarity: "Analyzing query...",
    research: "Researching...",
    validator: "Validating findings...",
    synthesis: "Generating summary...",
    interrupt: "Waiting for input..."
  };

  const message = icons[node] ?? `${node}...`;
  console.log(message);
}
