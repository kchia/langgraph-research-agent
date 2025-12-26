import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 60000, // LLM calls can be slow, especially with multiple tests
    fileParallelism: false, // Run test files sequentially to avoid API rate limits
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 1 // Run tests sequentially within files too
      }
    }
  }
});
