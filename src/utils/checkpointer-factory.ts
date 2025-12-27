import { z } from "zod";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger } from "./logger.js";

const logger = new Logger("checkpointer-factory");

/**
 * Zod schema for checkpointer configuration.
 */
const CheckpointerConfigSchema = z.object({
  type: z.enum(["memory", "sqlite"]),
  sqlitePath: z.string().optional()
});

/**
 * Checkpointer configuration type (inferred from schema).
 */
export type CheckpointerConfig = z.infer<typeof CheckpointerConfigSchema>;

/**
 * Checkpointer type enum values.
 */
export type CheckpointerType = CheckpointerConfig["type"];

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

  // Validate configuration with Zod
  const result = CheckpointerConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid checkpointer configuration: ${result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }

  const validatedConfig = result.data;

  switch (validatedConfig.type) {
    case "sqlite": {
      // Dynamic import to avoid requiring sqlite dependency if not used
      const moduleName = "@langchain/langgraph-checkpoint-sqlite";
      try {
        // Use variable to prevent TypeScript from checking the module
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sqliteModule = (await import(
          /* webpackIgnore: true */ moduleName
        )) as any;
        const SqliteSaver = sqliteModule.SqliteSaver;
        const dbPath = validatedConfig.sqlitePath ?? ":memory:";
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
      logger.info("Using in-memory checkpointer");
      return new MemorySaver();
  }
}

/**
 * Get checkpointer configuration from environment variables.
 *
 * @throws Error if CHECKPOINTER_TYPE is set to an invalid value
 */
export function getCheckpointerConfigFromEnv(): CheckpointerConfig {
  const rawConfig = {
    type: process.env.CHECKPOINTER_TYPE ?? "memory",
    sqlitePath: process.env.CHECKPOINTER_SQLITE_PATH
  };

  // Parse and validate with Zod
  const result = CheckpointerConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new Error(
      `Invalid checkpointer configuration: ${result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ")}`
    );
  }

  return result.data;
}
