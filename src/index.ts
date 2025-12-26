// Load environment variables FIRST before any other imports
// Import config.ts first - it loads dotenv at module level
import "./utils/config.js";

import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Command } from "@langchain/langgraph";
import { compileResearchGraph } from "./graph/workflow.js";
import { createNewQueryInput } from "./utils/state-helpers.js";
import { loadConfig, validateConfig } from "./utils/config.js";
import { Logger, generateCorrelationId } from "./utils/logger.js";
import {
  streamWithInterruptSupport,
  displayProgress
} from "./utils/streaming.js";
import {
  createCheckpointer,
  getCheckpointerConfigFromEnv
} from "./utils/checkpointer-factory.js";
import { streamWithTokens } from "./utils/token-streaming.js";

const logger = new Logger("cli");

// Check for --stream-tokens flag
const useTokenStreaming = process.argv.includes("--stream-tokens");

async function main() {
  // Load and validate config
  const config = loadConfig();
  try {
    validateConfig(config);
  } catch (error) {
    console.error("Configuration error:", error);
    process.exit(1);
  }

  // Create checkpointer based on configuration
  const checkpointerConfig = getCheckpointerConfigFromEnv();
  const checkpointer = await createCheckpointer(checkpointerConfig);

  // Build and compile graph with checkpointer
  const graph = compileResearchGraph(checkpointer);
  const threadId = crypto.randomUUID();
  const correlationId = generateCorrelationId();
  const graphConfig = {
    configurable: { thread_id: threadId, correlation_id: correlationId }
  };

  // Setup readline
  const rl = readline.createInterface({ input, output });

  console.log("╔════════════════════════════════════════════╗");
  console.log("║       Research Assistant                   ║");
  console.log("║  Type 'quit' to exit, 'new' for new thread ║");
  console.log("╚════════════════════════════════════════════╝");
  if (useTokenStreaming) {
    console.log("Token streaming mode enabled\n");
  } else {
    console.log("\n");
  }

  try {
    while (true) {
      const userInput = await rl.question("You: ");
      const trimmedInput = userInput.trim();

      if (trimmedInput.toLowerCase() === "quit") {
        console.log("\nGoodbye!");
        break;
      }

      if (trimmedInput.toLowerCase() === "new") {
        graphConfig.configurable.thread_id = crypto.randomUUID();
        console.log("\nStarted new conversation thread.\n");
        continue;
      }

      if (!trimmedInput) {
        continue;
      }

      try {
        let result: Record<string, unknown>;
        let interrupted: boolean;
        let interruptData: { question?: string } | undefined;

        if (useTokenStreaming) {
          // Token streaming mode - real-time LLM output
          ({ result, interrupted, interruptData } = await streamWithTokens(
            graph,
            createNewQueryInput(trimmedInput),
            graphConfig,
            {
              onNodeStart: (node) => {
                console.log(`\n[${node}] `);
              },
              onToken: (token) => {
                process.stdout.write(token);
              }
            }
          ));
        } else {
          // Standard streaming mode
          const streamResult = await streamWithInterruptSupport(
            graph,
            createNewQueryInput(trimmedInput),
            graphConfig,
            displayProgress
          );
          result = streamResult.result as Record<string, unknown>;
          interrupted = streamResult.interrupted;
          interruptData = streamResult.interruptData;
        }

        // Handle interrupt loop
        while (interrupted) {
          console.log(`\n${interruptData?.question}`);

          const clarification = await rl.question("You: ");
          const trimmedClarification = clarification.trim();

          if (trimmedClarification.toLowerCase() === "quit") {
            console.log("\nGoodbye!");
            rl.close();
            return;
          }

          if (useTokenStreaming) {
            ({ result, interrupted, interruptData } = await streamWithTokens(
              graph,
              new Command({ resume: trimmedClarification }),
              graphConfig,
              {
                onNodeStart: (node) => {
                  console.log(`\n[${node}] `);
                },
                onToken: (token) => {
                  process.stdout.write(token);
                }
              }
            ));
          } else {
            const streamResult = await streamWithInterruptSupport(
              graph,
              new Command({ resume: trimmedClarification }),
              graphConfig,
              displayProgress
            );
            result = streamResult.result as Record<string, unknown>;
            interrupted = streamResult.interrupted;
            interruptData = streamResult.interruptData;
          }
        }

        // Display result (only for non-streaming mode - streaming shows inline)
        if (!useTokenStreaming) {
          const finalSummary = result.finalSummary as string | null;
          if (finalSummary) {
            console.log(`\nAssistant:\n${finalSummary}\n`);
          } else {
            console.log("\nNo summary generated.\n");
          }
        } else {
          console.log("\n"); // Just add a newline after streaming
        }
      } catch (error) {
        logger.error("Graph execution failed", { error: String(error) });
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.log(
          `\n❌ An error occurred: ${errorMessage}\nPlease try again or type 'quit' to exit.\n`
        );
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
