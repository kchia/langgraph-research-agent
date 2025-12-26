import { defineConfig } from "vitest/config";

/**
 * E2E test configuration for tests that make real external API calls.
 * Run with: npm run test:e2e
 *
 * These tests require:
 * - TAVILY_API_KEY environment variable
 * - Network access to external APIs
 *
 * Note: May fail due to rate limits or API availability.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.e2e.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 60000
  }
});
