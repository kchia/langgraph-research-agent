import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 60000, // LLM calls can be slow, especially with multiple tests
    fileParallelism: true, // Run test files in parallel
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4 // Adjust based on your CPU cores / API rate limits
      }
    }
  }
});
