import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger } from "./logger.js";

const logger = new Logger("checkpointer-factory");

export type CheckpointerType = "memory" | "sqlite";

export interface CheckpointerConfig {
  type: CheckpointerType;
  sqlitePath?: string;
}

/**
 * Create a checkpointer instance based on configuration.
 *
 * - memory: In-process memory storage (not suitable for production)
 * - sqlite: SQLite-based persistent storage (requires optional dependency)
 */
export async function createCheckpointer(
  config: CheckpointerConfig = { type: "memory" }
): Promise<BaseCheckpointSaver> {
  logger.info("Creating checkpointer", { type: config.type });

  switch (config.type) {
    case "sqlite": {
      // Dynamic import to avoid requiring sqlite dependency if not used
      const moduleName = "@langchain/langgraph-checkpoint-sqlite";
      try {
        // Use variable to prevent TypeScript from checking the module
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sqliteModule = (await import(/* webpackIgnore: true */ moduleName)) as any;
        const SqliteSaver = sqliteModule.SqliteSaver;
        const dbPath = config.sqlitePath ?? ":memory:";
        logger.info("Initializing SQLite checkpointer", { path: dbPath });
        return SqliteSaver.fromConnString(dbPath);
      } catch (error) {
        logger.error("Failed to load SQLite checkpointer", { error });
        throw new Error(
          `SQLite checkpointer requires ${moduleName}. ` +
            `Install with: npm install ${moduleName}`
        );
      }
    }

    case "memory":
    default:
      logger.info("Using in-memory checkpointer");
      return new MemorySaver();
  }
}

/**
 * Get checkpointer configuration from environment variables.
 */
export function getCheckpointerConfigFromEnv(): CheckpointerConfig {
  return {
    type: (process.env.CHECKPOINTER_TYPE ?? "memory") as CheckpointerType,
    sqlitePath: process.env.CHECKPOINTER_SQLITE_PATH
  };
}
