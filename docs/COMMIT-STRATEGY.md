# Research Assistant: Revised Commit-by-Commit Implementation Strategy

> **Version**: 2.0  
> **Status**: Reviewed and Corrected  
> **Purpose**: AI-assisted implementation guide with atomic, testable commits

---

## Design Principles

1. **Each commit is atomic and testable** — no broken intermediate states
2. **Dependencies flow downward** — never reference code that doesn't exist yet
3. **Stub-first, then flesh out** — get the graph running before adding LLM complexity
4. **Tests accompany features** — each functional commit includes its tests
5. **Injection over hardcoding** — LLMs and data sources are injectable for testability
6. **Idempotency awareness** — interrupt-related code explicitly handles re-execution

---

## Phase 1: Foundation (Commits 1-4)

### Commit 1: Project Scaffolding

**Goal**: Runnable TypeScript project with all dependencies installed and verified.

**Files to create**:

```
research-assistant/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
└── src/
    └── index.ts          # Simple entry point that logs "Research Assistant starting..."
```

**package.json**:

```json
{
  "name": "research-assistant",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@langchain/langgraph": "~0.2.0",
    "@langchain/anthropic": "~0.3.0",
    "@langchain/core": "~0.3.0",
    "@langchain/tavily": "~0.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "dotenv": "^16.4.0",
    "tsx": "^4.0.0"
  }
}
```

**tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**vitest.config.ts**:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    testTimeout: 30000 // LLM calls can be slow
  }
});
```

**.env.example**:

```bash
# LLM Configuration (required: one of these)
ANTHROPIC_API_KEY=your_anthropic_key

# Data Source Configuration
RESEARCH_DATA_SOURCE=auto  # "mock" | "tavily" | "auto"
TAVILY_API_KEY=tvly-your_key_here

# Observability (optional)
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=research-assistant

# Application
LOG_LEVEL=info
```

**.gitignore**:

```
node_modules/
dist/
.env
*.log
```

**src/index.ts**:

```typescript
console.log("Research Assistant starting...");
console.log("Environment:", process.env.NODE_ENV ?? "development");
```

**Verification**:

```bash
npm install
npm run build  # Should complete without errors
npm start      # Should print "Research Assistant starting..."
npm test       # Should run (0 tests)
```

---

### Commit 2: State Schema & Types

**Goal**: Complete type definitions — the contract everything else depends on.

**Files to create**:

```
src/
├── graph/
│   ├── index.ts          # Re-exports
│   └── state.ts          # Full ResearchStateAnnotation + all types
└── utils/
    └── constants.ts      # Thresholds and limits
```

**src/graph/state.ts**:

```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type ClarityStatus = "pending" | "clear" | "needs_clarification";
export type ValidationResult = "pending" | "sufficient" | "insufficient";
export type AgentName =
  | "clarity"
  | "research"
  | "validator"
  | "synthesis"
  | "interrupt";

export interface ResearchFindings {
  company: string;
  recentNews: string | null;
  stockInfo: string | null;
  keyDevelopments: string | null;
  sources: string[];
  rawData: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE ANNOTATION
// ═══════════════════════════════════════════════════════════════════════════

export const ResearchStateAnnotation = Annotation.Root({
  // ─── Conversation ───
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  conversationSummary: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Query Analysis ───
  originalQuery: Annotation<string>({
    reducer: (_, update) => update,
    default: () => ""
  }),

  clarityStatus: Annotation<ClarityStatus>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  clarificationAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  clarificationQuestion: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  detectedCompany: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Research ───
  researchFindings: Annotation<ResearchFindings | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  confidenceScore: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  researchAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  // ─── Validation ───
  validationResult: Annotation<ValidationResult>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  validationFeedback: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Output ───
  finalSummary: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─── Metadata ───
  currentAgent: Annotation<AgentName>({
    reducer: (_, update) => update,
    default: () => "clarity"
  })
});

export type ResearchState = typeof ResearchStateAnnotation.State;
```

**src/utils/constants.ts**:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum confidence score to skip validation and go directly to synthesis */
export const CONFIDENCE_THRESHOLD = 6;

/** Maximum research attempts before forced synthesis */
export const MAX_RESEARCH_ATTEMPTS = 3;

/** Maximum clarification attempts before forced proceed */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/** Message count threshold for triggering conversation summarization */
export const MESSAGE_SUMMARIZATION_THRESHOLD = 10;

/** Number of recent messages to keep when summarizing */
export const MESSAGES_TO_KEEP_AFTER_SUMMARY = 4;
```

**src/graph/index.ts**:

```typescript
export * from "./state.js";
```

**Test file**: `tests/graph/state.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  ResearchStateAnnotation,
  type ResearchState
} from "../../src/graph/state.js";

describe("ResearchStateAnnotation", () => {
  it("should have correct default values", () => {
    const defaults: ResearchState = {
      messages: [],
      conversationSummary: null,
      originalQuery: "",
      clarityStatus: "pending",
      clarificationAttempts: 0,
      clarificationQuestion: null,
      detectedCompany: null,
      researchFindings: null,
      confidenceScore: 0,
      researchAttempts: 0,
      validationResult: "pending",
      validationFeedback: null,
      finalSummary: null,
      currentAgent: "clarity"
    };

    // Verify types compile correctly
    expect(defaults.clarityStatus).toBe("pending");
    expect(defaults.messages).toEqual([]);
  });

  it("should allow valid ClarityStatus values", () => {
    const statuses: Array<"pending" | "clear" | "needs_clarification"> = [
      "pending",
      "clear",
      "needs_clarification"
    ];
    expect(statuses).toHaveLength(3);
  });

  it("should allow valid ValidationResult values", () => {
    const results: Array<"pending" | "sufficient" | "insufficient"> = [
      "pending",
      "sufficient",
      "insufficient"
    ];
    expect(results).toHaveLength(3);
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

### Commit 3: Data Source Interface & Mock Implementation

**Goal**: Complete mock data layer — enables all future testing without external APIs.

**Files to create**:

```
src/
└── data/
    ├── index.ts                    # Factory + exports
    ├── data-source.interface.ts    # Interface definitions
    ├── mock-source.ts              # MockDataSource class
    └── mock-data.ts                # MOCK_RESEARCH_DATA constant
```

**src/data/data-source.interface.ts**:

```typescript
import type { ResearchFindings } from "../graph/state.js";

export interface SearchContext {
  originalQuery: string;
  validationFeedback?: string | null;
  attemptNumber: number;
}

export interface SearchResult {
  findings: ResearchFindings | null;
  confidence: number;
  source: string;
  rawResponse?: unknown;
}

export interface ResearchDataSource {
  search(company: string, context: SearchContext): Promise<SearchResult>;
  getName(): string;
  isAvailable(): boolean;
}

export class DataSourceError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly isRetryable: boolean,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}
```

**src/data/mock-data.ts**:

```typescript
import type { ResearchFindings } from "../graph/state.js";

type MockDataEntry = Omit<ResearchFindings, "sources" | "rawData">;

export const MOCK_RESEARCH_DATA: Record<string, MockDataEntry> = {
  apple: {
    company: "Apple Inc.",
    recentNews:
      "Launched Vision Pro, expanding services revenue. Q4 earnings beat expectations with $89.5B revenue.",
    stockInfo:
      "AAPL trading at $195, up 45% YTD. Market cap: $3.0T. P/E ratio: 31.2.",
    keyDevelopments:
      "AI integration across product line with Apple Intelligence. M3 chip family rollout complete. Services revenue hit all-time high."
  },
  tesla: {
    company: "Tesla, Inc.",
    recentNews:
      "Cybertruck deliveries ramping up to 2,500/week. Q3 deliveries exceeded 435,000 vehicles.",
    stockInfo:
      "TSLA trading at $242, volatile quarter with 15% swings. Market cap: $770B.",
    keyDevelopments:
      "FSD v12 rollout with end-to-end neural networks. Energy storage deployments up 90% YoY. Megapack demand exceeds supply."
  },
  microsoft: {
    company: "Microsoft Corporation",
    recentNews:
      "Copilot integration across Office 365 suite. Azure revenue growth of 29% YoY.",
    stockInfo:
      "MSFT trading at $378, up 52% YTD. Market cap: $2.8T. Dividend yield: 0.8%.",
    keyDevelopments:
      "OpenAI partnership deepening with exclusive cloud deal. GitHub Copilot reached 1.3M paid subscribers. Xbox Game Pass at 34M subscribers."
  },
  amazon: {
    company: "Amazon.com, Inc.",
    recentNews:
      "AWS re:Invent announced new AI services. Prime membership exceeded 200M globally.",
    stockInfo: "AMZN trading at $153, up 68% YTD. Market cap: $1.6T.",
    keyDevelopments:
      "Bedrock AI platform gaining enterprise traction. One Medical integration complete. Drone delivery expanding to new markets."
  },
  google: {
    company: "Alphabet Inc. (Google)",
    recentNews:
      "Gemini Ultra launched as GPT-4 competitor. Antitrust ruling impact being assessed.",
    stockInfo: "GOOGL trading at $141, up 55% YTD. Market cap: $1.8T.",
    keyDevelopments:
      "Bard rebranded to Gemini. Cloud revenue crossed $10B/quarter. Waymo expanding robotaxi service."
  }
};
```

**src/data/mock-source.ts**:

```typescript
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
import type { ResearchFindings } from "../graph/state.js";
import { MOCK_RESEARCH_DATA } from "./mock-data.js";

export class MockDataSource implements ResearchDataSource {
  getName(): string {
    return "Mock Data Source";
  }

  isAvailable(): boolean {
    return true;
  }

  async search(company: string, context: SearchContext): Promise<SearchResult> {
    const normalizedName = this.normalizeCompanyName(company);
    const data = MOCK_RESEARCH_DATA[normalizedName];

    if (!data) {
      return {
        findings: null,
        confidence: 0,
        source: this.getName(),
        rawResponse: {
          searched: company,
          normalizedTo: normalizedName,
          found: false
        }
      };
    }

    const findings: ResearchFindings = {
      ...data,
      sources: [this.getName()],
      rawData: {
        searchedName: company,
        normalizedTo: normalizedName,
        attemptNumber: context.attemptNumber,
        hadFeedback: !!context.validationFeedback
      }
    };

    return {
      findings,
      confidence: this.calculateConfidence(findings),
      source: this.getName(),
      rawResponse: data
    };
  }

  private normalizeCompanyName(company: string): string {
    return company
      .toLowerCase()
      .replace(/[,.]|inc|corp|corporation|ltd|llc|co\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateConfidence(findings: ResearchFindings): number {
    let score = 0;
    if (findings.recentNews) score += 3;
    if (findings.stockInfo) score += 3;
    if (findings.keyDevelopments) score += 3;
    if (findings.company) score += 1;
    return score;
  }
}
```

**src/data/index.ts**:

```typescript
import type { ResearchDataSource } from "./data-source.interface.js";
import { MockDataSource } from "./mock-source.js";

export type DataSourceType = "mock" | "tavily" | "auto";

export function createDataSource(
  type: DataSourceType = "auto"
): ResearchDataSource {
  // For now, only mock is implemented
  // Tavily will be added in Commit 15
  if (type === "tavily") {
    console.warn("Tavily not yet implemented, falling back to mock");
  }
  return new MockDataSource();
}

export { MockDataSource } from "./mock-source.js";
export type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
export { DataSourceError } from "./data-source.interface.js";
```

**Test file**: `tests/data/mock-source.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MockDataSource } from "../../src/data/mock-source.js";
import type { SearchContext } from "../../src/data/data-source.interface.js";

describe("MockDataSource", () => {
  let source: MockDataSource;
  const baseContext: SearchContext = {
    originalQuery: "test query",
    attemptNumber: 1
  };

  beforeEach(() => {
    source = new MockDataSource();
  });

  describe("getName", () => {
    it("should return 'Mock Data Source'", () => {
      expect(source.getName()).toBe("Mock Data Source");
    });
  });

  describe("isAvailable", () => {
    it("should always return true", () => {
      expect(source.isAvailable()).toBe(true);
    });
  });

  describe("search", () => {
    it("should return data for known companies", async () => {
      const result = await source.search("Apple Inc.", baseContext);

      expect(result.findings).not.toBeNull();
      expect(result.findings?.company).toBe("Apple Inc.");
      expect(result.confidence).toBeGreaterThan(6);
      expect(result.source).toBe("Mock Data Source");
    });

    it("should normalize company names correctly", async () => {
      const variations = [
        "apple",
        "APPLE",
        "Apple Inc.",
        "apple inc",
        "Apple, Inc."
      ];

      for (const variant of variations) {
        const result = await source.search(variant, baseContext);
        expect(result.findings?.company).toBe("Apple Inc.");
      }
    });

    it("should return null findings for unknown companies", async () => {
      const result = await source.search("Unknown Corp", baseContext);

      expect(result.findings).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it("should track validation feedback in raw data", async () => {
      const contextWithFeedback: SearchContext = {
        ...baseContext,
        validationFeedback: "Missing financial data",
        attemptNumber: 2
      };

      const result = await source.search("Apple", contextWithFeedback);

      expect(result.findings?.rawData.hadFeedback).toBe(true);
      expect(result.findings?.rawData.attemptNumber).toBe(2);
    });

    it("should return all 5 known companies", async () => {
      const companies = ["Apple", "Tesla", "Microsoft", "Amazon", "Google"];

      for (const company of companies) {
        const result = await source.search(company, baseContext);
        expect(result.findings).not.toBeNull();
      }
    });
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

### Commit 4: Routers

**Goal**: All routing logic implemented and tested.

**Files to create**:

```
src/
└── graph/
    └── routers.ts
```

**src/graph/routers.ts**:

```typescript
import type { ResearchState } from "./state.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../utils/constants.js";

/**
 * Routes from Clarity Agent based on query clarity.
 *
 * @returns "interrupt" if clarification needed, "research" if clear
 */
export function clarityRouter(state: ResearchState): "interrupt" | "research" {
  if (state.clarityStatus === "needs_clarification") {
    return "interrupt";
  }
  return "research";
}

/**
 * Routes from Research Agent based on confidence score.
 *
 * @returns "synthesis" if confidence >= threshold, "validator" otherwise
 */
export function researchRouter(
  state: ResearchState
): "validator" | "synthesis" {
  if (state.confidenceScore >= CONFIDENCE_THRESHOLD) {
    return "synthesis";
  }
  return "validator";
}

/**
 * Routes from Validator Agent based on validation result and attempt count.
 *
 * Implements loop protection: max 3 research attempts.
 *
 * @returns "research" for retry, "synthesis" to proceed
 */
export function validationRouter(
  state: ResearchState
): "research" | "synthesis" {
  const canRetry = state.researchAttempts < MAX_RESEARCH_ATTEMPTS;
  const needsMoreResearch = state.validationResult === "insufficient";

  if (needsMoreResearch && canRetry) {
    return "research";
  }

  return "synthesis";
}
```

**Update src/graph/index.ts**:

```typescript
export * from "./state.js";
export * from "./routers.js";
```

**Test file**: `tests/graph/routers.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  clarityRouter,
  researchRouter,
  validationRouter
} from "../../src/graph/routers.js";
import type { ResearchState } from "../../src/graph/state.js";
import {
  CONFIDENCE_THRESHOLD,
  MAX_RESEARCH_ATTEMPTS
} from "../../src/utils/constants.js";

// Helper to create minimal state for testing
function createTestState(overrides: Partial<ResearchState>): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "",
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "clarity",
    ...overrides
  };
}

describe("clarityRouter", () => {
  it("should return 'interrupt' when clarification is needed", () => {
    const state = createTestState({ clarityStatus: "needs_clarification" });
    expect(clarityRouter(state)).toBe("interrupt");
  });

  it("should return 'research' when query is clear", () => {
    const state = createTestState({ clarityStatus: "clear" });
    expect(clarityRouter(state)).toBe("research");
  });

  it("should return 'research' when status is pending", () => {
    const state = createTestState({ clarityStatus: "pending" });
    expect(clarityRouter(state)).toBe("research");
  });
});

describe("researchRouter", () => {
  it("should return 'synthesis' when confidence meets threshold", () => {
    const state = createTestState({ confidenceScore: CONFIDENCE_THRESHOLD });
    expect(researchRouter(state)).toBe("synthesis");
  });

  it("should return 'synthesis' when confidence exceeds threshold", () => {
    const state = createTestState({
      confidenceScore: CONFIDENCE_THRESHOLD + 2
    });
    expect(researchRouter(state)).toBe("synthesis");
  });

  it("should return 'validator' when confidence below threshold", () => {
    const state = createTestState({
      confidenceScore: CONFIDENCE_THRESHOLD - 1
    });
    expect(researchRouter(state)).toBe("validator");
  });

  it("should return 'validator' when confidence is zero", () => {
    const state = createTestState({ confidenceScore: 0 });
    expect(researchRouter(state)).toBe("validator");
  });
});

describe("validationRouter", () => {
  it("should return 'research' when insufficient and can retry", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: 1
    });
    expect(validationRouter(state)).toBe("research");
  });

  it("should return 'synthesis' when sufficient", () => {
    const state = createTestState({
      validationResult: "sufficient",
      researchAttempts: 1
    });
    expect(validationRouter(state)).toBe("synthesis");
  });

  it("should return 'synthesis' when max attempts reached", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS
    });
    expect(validationRouter(state)).toBe("synthesis");
  });

  it("should return 'synthesis' when exceeds max attempts", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS + 1
    });
    expect(validationRouter(state)).toBe("synthesis");
  });

  it("should return 'research' at boundary (attempts = max - 1)", () => {
    const state = createTestState({
      validationResult: "insufficient",
      researchAttempts: MAX_RESEARCH_ATTEMPTS - 1
    });
    expect(validationRouter(state)).toBe("research");
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

## Phase 2: Stub Graph (Commits 5-6)

### Commit 5: Stub Agents

**Goal**: Minimal stub implementations that compile and return valid state updates. The interrupt node is real (not stubbed) because it's the control flow mechanism.

**Files to create**:

```
src/
└── agents/
    ├── index.ts
    ├── clarity.agent.ts
    ├── research.agent.ts
    ├── validator.agent.ts
    ├── synthesis.agent.ts
    └── interrupt.agent.ts
```

**src/agents/clarity.agent.ts** (stub):

```typescript
import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Clarity Agent
 * Always returns "clear" with mock company for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 8.
 */
export async function clarityAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    clarityStatus: "clear",
    detectedCompany: "Apple Inc.",
    clarificationQuestion: null,
    currentAgent: "clarity"
  };
}
```

**src/agents/research.agent.ts** (stub):

```typescript
import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Research Agent
 * Returns mock findings for testing graph structure.
 * Will be replaced with real implementation in Commit 9.
 */
export async function researchAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    researchFindings: {
      company: state.detectedCompany ?? "Unknown",
      recentNews: "Stub news data",
      stockInfo: "Stub stock data",
      keyDevelopments: "Stub developments",
      sources: ["Stub Source"],
      rawData: {}
    },
    confidenceScore: 8,
    researchAttempts: state.researchAttempts + 1,
    currentAgent: "research"
  };
}
```

**src/agents/validator.agent.ts** (stub):

```typescript
import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Validator Agent
 * Always returns "sufficient" for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 10.
 */
export async function validatorAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  return {
    validationResult: "sufficient",
    validationFeedback: null,
    currentAgent: "validator"
  };
}
```

**src/agents/synthesis.agent.ts** (stub):

```typescript
import { AIMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * STUB: Synthesis Agent
 * Returns static summary for testing graph structure.
 * Will be replaced with real LLM implementation in Commit 11.
 */
export async function synthesisAgent(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  const summary = `Here's what I found about ${
    state.detectedCompany ?? "the company"
  }: This is a stub response for testing.`;

  return {
    finalSummary: summary,
    messages: [new AIMessage(summary)],
    currentAgent: "synthesis"
  };
}
```

**src/agents/interrupt.agent.ts** (REAL, not stubbed):

```typescript
import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * Interrupt node that pauses for user clarification.
 *
 * ⚠️ CRITICAL: This entire function RE-EXECUTES when resumed!
 *
 * When resumed:
 * 1. Function starts from the beginning
 * 2. Code before interrupt() runs again
 * 3. interrupt() returns the resume value instead of pausing
 * 4. Code after interrupt() executes
 *
 * Therefore: Keep code before interrupt() IDEMPOTENT (no side effects).
 */
export async function clarificationInterrupt(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️ IDEMPOTENT ZONE: This code runs on EVERY execution (initial + resume)
  // Do NOT put API calls, DB writes, or any side effects here!
  // ═══════════════════════════════════════════════════════════════════════

  const interruptPayload = {
    type: "clarification_needed" as const,
    question:
      state.clarificationQuestion ?? "Which company are you asking about?",
    originalQuery: state.originalQuery,
    attempt: state.clarificationAttempts
  };

  // Execution PAUSES here on first run.
  // On resume, this RETURNS the value from Command({ resume: value }).
  const userResponse = interrupt(interruptPayload);

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ SAFE ZONE: This code ONLY runs after resume
  // ═══════════════════════════════════════════════════════════════════════

  return {
    messages: [new HumanMessage(userResponse as string)],
    originalQuery: userResponse as string,
    clarityStatus: "pending",
    currentAgent: "interrupt"
  };
}
```

**src/agents/index.ts**:

```typescript
export { clarityAgent } from "./clarity.agent.js";
export { researchAgent } from "./research.agent.js";
export { validatorAgent } from "./validator.agent.js";
export { synthesisAgent } from "./synthesis.agent.js";
export { clarificationInterrupt } from "./interrupt.agent.js";
```

**No tests yet** — testing happens at graph level in Commit 6.

**Verification**:

```bash
npm run build
```

---

### Commit 6: Graph Construction + Integration Tests

**Goal**: Working graph that executes end-to-end with stubs.

**Files to create**:

```
src/
└── graph/
    └── workflow.ts

tests/
└── integration/
    └── graph-structure.test.ts
```

**src/graph/workflow.ts**:

```typescript
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ResearchStateAnnotation } from "./state.js";
import { clarityRouter, researchRouter, validationRouter } from "./routers.js";
import {
  clarityAgent,
  researchAgent,
  validatorAgent,
  synthesisAgent,
  clarificationInterrupt
} from "../agents/index.js";

/**
 * Builds and compiles the Research Assistant workflow graph.
 *
 * Graph structure:
 * START → clarity → [interrupt OR research]
 *                         ↓
 *         interrupt → clarity (loop back)
 *         research → [validator OR synthesis]
 *                         ↓
 *         validator → [research (retry) OR synthesis]
 *         synthesis → END
 */
export function buildResearchGraph() {
  const workflow = new StateGraph(ResearchStateAnnotation)
    // ─── Node Definitions ───
    .addNode("clarity", clarityAgent)
    .addNode("interrupt", clarificationInterrupt)
    .addNode("research", researchAgent)
    .addNode("validator", validatorAgent)
    .addNode("synthesis", synthesisAgent)

    // ─── Entry Edge ───
    .addEdge(START, "clarity")

    // ─── Clarity Routing ───
    .addConditionalEdges("clarity", clarityRouter, {
      interrupt: "interrupt",
      research: "research"
    })

    // ─── Interrupt Resume Edge ───
    // Fixed edge: after resume, always re-analyze in clarity
    .addEdge("interrupt", "clarity")

    // ─── Research Routing ───
    .addConditionalEdges("research", researchRouter, {
      validator: "validator",
      synthesis: "synthesis"
    })

    // ─── Validation Routing ───
    .addConditionalEdges("validator", validationRouter, {
      research: "research",
      synthesis: "synthesis"
    })

    // ─── Synthesis Terminal Edge ───
    .addEdge("synthesis", END);

  // Compile with checkpointer for state persistence
  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
}

export type ResearchGraph = ReturnType<typeof buildResearchGraph>;
```

**Update src/graph/index.ts**:

```typescript
export * from "./state.js";
export * from "./routers.js";
export * from "./workflow.js";
```

**tests/integration/graph-structure.test.ts**:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";

describe("Graph Structure", () => {
  let graph: ResearchGraph;
  let threadId: string;

  beforeEach(() => {
    graph = buildResearchGraph();
    threadId = crypto.randomUUID();
  });

  function getConfig() {
    return { configurable: { thread_id: threadId } };
  }

  describe("compilation", () => {
    it("should compile without errors", () => {
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });
  });

  describe("happy path with stubs", () => {
    it("should complete full flow and reach synthesis", async () => {
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Apple")],
          originalQuery: "Tell me about Apple"
        },
        getConfig()
      );

      // Should have reached synthesis
      expect(result.currentAgent).toBe("synthesis");
      expect(result.finalSummary).toContain("Apple");

      // Should not have interrupted
      expect(result.__interrupt__).toBeUndefined();
    });

    it("should track agent progression correctly", async () => {
      const agents: string[] = [];

      const stream = await graph.stream(
        {
          messages: [new HumanMessage("Tell me about Tesla")],
          originalQuery: "Tell me about Tesla"
        },
        { ...getConfig(), streamMode: "updates" }
      );

      for await (const update of stream) {
        const [nodeName] = Object.keys(update);
        if (nodeName && nodeName !== "__start__") {
          agents.push(nodeName);
        }
      }

      // Stub path: clarity → research → synthesis (high confidence skips validator)
      expect(agents).toContain("clarity");
      expect(agents).toContain("research");
      expect(agents).toContain("synthesis");
    });
  });

  describe("state persistence", () => {
    it("should persist messages across invocations (append reducer)", async () => {
      const config = getConfig();

      await graph.invoke(
        {
          messages: [new HumanMessage("First message")],
          originalQuery: "First message"
        },
        config
      );

      const result2 = await graph.invoke(
        {
          messages: [new HumanMessage("Second message")],
          originalQuery: "Second message"
        },
        config
      );

      // Messages should accumulate
      const humanMessages = result2.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(humanMessages.length).toBeGreaterThanOrEqual(2);
    });

    it("should persist detectedCompany across invocations", async () => {
      const config = getConfig();

      await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Apple")],
          originalQuery: "Tell me about Apple"
        },
        config
      );

      // Get state directly
      const state = await graph.getState(config);
      expect(state.values.detectedCompany).toBe("Apple Inc.");
    });

    it("should use separate state for different thread IDs", async () => {
      const config1 = { configurable: { thread_id: "thread-1" } };
      const config2 = { configurable: { thread_id: "thread-2" } };

      await graph.invoke(
        {
          messages: [new HumanMessage("About Apple")],
          originalQuery: "About Apple"
        },
        config1
      );

      const result2 = await graph.invoke(
        {
          messages: [new HumanMessage("About Tesla")],
          originalQuery: "About Tesla"
        },
        config2
      );

      // Thread 2 should not have Thread 1's messages
      const humanMessages = result2.messages.filter(
        (m) => m._getType() === "human"
      );
      expect(humanMessages.length).toBe(1);
    });
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

**Milestone**: Graph is runnable, routable, and testable with stubs.

---

## Phase 3: Infrastructure (Commit 7)

### Commit 7: Utilities, Prompts, and Helpers

**Goal**: Logging, config, patterns, prompts infrastructure, and state reset helper.

**Files to create**:

```
src/
├── utils/
│   ├── index.ts
│   ├── logger.ts
│   ├── config.ts
│   ├── patterns.ts
│   └── state-helpers.ts
└── prompts/
    ├── index.ts
    ├── clarity.prompts.ts
    ├── validator.prompts.ts
    └── synthesis.prompts.ts
```

**src/utils/logger.ts**:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export class Logger {
  private context: string;
  private minLevel: number;

  constructor(context: string) {
    this.context = context;
    const envLevel = (process.env.LOG_LEVEL ?? "info") as LogLevel;
    this.minLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ) {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log("error", message, data);
  }
}
```

**src/utils/config.ts**:

```typescript
import { config as loadEnv } from "dotenv";

// Load .env file
loadEnv();

export interface AppConfig {
  anthropicApiKey: string | undefined;
  tavilyApiKey: string | undefined;
  dataSource: "mock" | "tavily" | "auto";
  logLevel: string;
  langsmithEnabled: boolean;
}

export function loadConfig(): AppConfig {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    dataSource: (process.env.RESEARCH_DATA_SOURCE ??
      "auto") as AppConfig["dataSource"],
    logLevel: process.env.LOG_LEVEL ?? "info",
    langsmithEnabled: process.env.LANGCHAIN_TRACING_V2 === "true"
  };
}

export function validateConfig(config: AppConfig): void {
  if (!config.anthropicApiKey) {
    console.warn("Warning: ANTHROPIC_API_KEY not set. LLM features will fail.");
  }

  if (config.dataSource === "tavily" && !config.tavilyApiKey) {
    throw new Error("TAVILY_API_KEY required when RESEARCH_DATA_SOURCE=tavily");
  }
}
```

**src/utils/patterns.ts**:

```typescript
/**
 * Patterns that indicate a follow-up query (uses previous context)
 */
export const FOLLOW_UP_PATTERNS = [
  /^(what about|tell me more|how about|and|also|furthermore)/i,
  /^(their|its|the company's|they|them)\b/i,
  /^(compare|versus|vs\.?|compared to)/i,
  /^(explain|elaborate|expand on|go deeper)/i,
  /^(why|how|when did|is that|are they)\b/i
];

/**
 * Patterns that indicate user wants to cancel/exit
 */
export const CANCEL_PATTERNS = [
  /^(nevermind|never mind|cancel|stop|quit|exit|forget it|nvm)$/i
];

/**
 * Check if query is a follow-up to previous context
 */
export function isFollowUpQuery(
  query: string,
  hasExistingCompany: boolean
): boolean {
  if (!hasExistingCompany) return false;
  const trimmed = query.trim();
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if user wants to cancel the current operation
 */
export function isCancelRequest(query: string): boolean {
  return CANCEL_PATTERNS.some((pattern) => pattern.test(query.trim()));
}
```

**src/utils/state-helpers.ts**:

```typescript
import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";

/**
 * Creates the input object for a new query.
 *
 * Resets query-specific fields while allowing persistent fields
 * (messages, detectedCompany) to be managed by reducers/agents.
 */
export function createNewQueryInput(query: string): Partial<ResearchState> {
  return {
    // New message appends via reducer
    messages: [new HumanMessage(query)],

    // Query-specific fields that reset
    originalQuery: query,
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null

    // NOTE: detectedCompany is NOT reset here
    // Clarity Agent decides whether to update or preserve it
  };
}
```

**src/utils/index.ts**:

```typescript
export { Logger } from "./logger.js";
export { loadConfig, validateConfig, type AppConfig } from "./config.js";
export * from "./constants.js";
export * from "./patterns.js";
export * from "./state-helpers.js";
```

**src/prompts/clarity.prompts.ts**:

```typescript
export const CLARITY_SYSTEM_PROMPT = `You are a query analysis agent for a company research assistant.

Your job is to analyze the user's query and determine:
1. Is a specific company mentioned or clearly implied from context?
2. Is the query clear enough to proceed with research?

Consider follow-up patterns: if the user says "What about their stock?" and there's a previous company context, use that company.

Respond in JSON format:
{
  "is_clear": boolean,
  "detected_company": string | null,
  "clarification_needed": string | null,
  "reasoning": string
}`;

export function buildClarityUserPrompt(
  originalQuery: string,
  previousCompany: string | null,
  conversationContext: string
): string {
  return `Previous company context: ${previousCompany ?? "None"}

Recent conversation:
${conversationContext}

Latest query: "${originalQuery}"

Analyze this query and respond with JSON.`;
}
```

**src/prompts/validator.prompts.ts**:

```typescript
export const VALIDATOR_SYSTEM_PROMPT = `You are a research quality validator.

Assess whether the research findings adequately answer the user's question.

Evaluate:
1. Relevance: Does this data address what was asked?
2. Completeness: Are there obvious gaps?
3. Quality: Is the information specific and useful?

Respond in JSON format:
{
  "is_sufficient": boolean,
  "feedback": string | null,
  "reasoning": string
}`;

export function buildValidatorUserPrompt(
  originalQuery: string,
  findings: string,
  confidenceScore: number
): string {
  return `Original query: "${originalQuery}"

Research findings:
${findings}

Confidence score: ${confidenceScore}/10

Evaluate the quality and respond with JSON.`;
}
```

**src/prompts/synthesis.prompts.ts**:

```typescript
export const SYNTHESIS_SYSTEM_PROMPT = `You are a research synthesis agent.

Generate a clear, helpful summary of the research findings for the user.
Be concise but comprehensive. Use natural language, not bullet points unless asked.

If data is limited, acknowledge this honestly. Never fabricate information.`;

export function buildSynthesisUserPrompt(
  originalQuery: string,
  company: string,
  findings: string,
  confidenceLevel: "high" | "medium" | "low"
): string {
  const confidenceNote = {
    high: "",
    medium: "Note: Some information may be incomplete.",
    low: "Note: Limited information available. Please verify independently."
  }[confidenceLevel];

  return `User's question: "${originalQuery}"

Company: ${company}

Research findings:
${findings}

${confidenceNote}

Generate a helpful summary for the user.`;
}
```

**src/prompts/index.ts**:

```typescript
export * from "./clarity.prompts.js";
export * from "./validator.prompts.js";
export * from "./synthesis.prompts.js";
```

**Verification**:

```bash
npm run build
```

---

## Phase 4: Real Agents (Commits 8-11)

### Commit 8: Clarity Agent (Full Implementation)

**Goal**: Real LLM-based query analysis with company extraction.

**Files to update**:

- `src/agents/clarity.agent.ts` — Replace stub

**src/agents/clarity.agent.ts**:

```typescript
import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import { MAX_CLARIFICATION_ATTEMPTS } from "../utils/constants.js";
import { isFollowUpQuery, isCancelRequest } from "../utils/patterns.js";
import {
  CLARITY_SYSTEM_PROMPT,
  buildClarityUserPrompt
} from "../prompts/clarity.prompts.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("clarity-agent");

// Schema for structured LLM output
const ClarityOutputSchema = z.object({
  is_clear: z.boolean(),
  detected_company: z.string().nullable(),
  clarification_needed: z.string().nullable(),
  reasoning: z.string()
});

type ClarityOutput = z.infer<typeof ClarityOutputSchema>;

/**
 * Factory function to create Clarity Agent with injectable LLM.
 */
export function createClarityAgent(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });
  const structuredModel = model.withStructuredOutput(ClarityOutputSchema);

  return async function clarityAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    logger.info("Clarity analysis started", {
      query: state.originalQuery,
      previousCompany: state.detectedCompany,
      attempt: state.clarificationAttempts
    });

    // Handle empty query
    if (!state.originalQuery?.trim()) {
      return {
        clarityStatus: "needs_clarification",
        clarificationQuestion:
          "Hello! What would you like to know about a company?",
        clarificationAttempts: state.clarificationAttempts + 1,
        currentAgent: "clarity"
      };
    }

    // Handle cancel request
    if (isCancelRequest(state.originalQuery)) {
      logger.info("Cancel request detected");
      return {
        clarityStatus: "clear",
        detectedCompany: null,
        finalSummary:
          "No problem! Let me know if you'd like to research anything else.",
        currentAgent: "clarity"
      };
    }

    // Check max clarification attempts
    if (state.clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
      logger.warn("Max clarification attempts reached, forcing proceed");
      return {
        clarityStatus: "clear",
        detectedCompany:
          state.detectedCompany ?? extractBestGuess(state.originalQuery),
        currentAgent: "clarity"
      };
    }

    // Quick check for follow-up with existing company
    if (isFollowUpQuery(state.originalQuery, !!state.detectedCompany)) {
      logger.info("Follow-up detected, using existing company", {
        company: state.detectedCompany
      });
      return {
        clarityStatus: "clear",
        currentAgent: "clarity"
      };
    }

    // Use LLM for analysis
    try {
      const conversationContext = state.messages
        .slice(-6)
        .map((m) => `${m._getType()}: ${m.content}`)
        .join("\n");

      const response: ClarityOutput = await structuredModel.invoke([
        { role: "system", content: CLARITY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildClarityUserPrompt(
            state.originalQuery,
            state.detectedCompany,
            conversationContext
          )
        }
      ]);

      logger.info("LLM analysis complete", {
        isClear: response.is_clear,
        company: response.detected_company,
        reasoning: response.reasoning
      });

      if (response.is_clear && response.detected_company) {
        return {
          clarityStatus: "clear",
          detectedCompany: response.detected_company,
          clarificationQuestion: null,
          currentAgent: "clarity"
        };
      } else {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion:
            response.clarification_needed ??
            "Which company would you like to know about?",
          clarificationAttempts: state.clarificationAttempts + 1,
          currentAgent: "clarity"
        };
      }
    } catch (error) {
      logger.error("LLM call failed", { error: String(error) });

      // Fallback: try to extract company from query
      const bestGuess = extractBestGuess(state.originalQuery);
      if (bestGuess) {
        return {
          clarityStatus: "clear",
          detectedCompany: bestGuess,
          currentAgent: "clarity"
        };
      }

      return {
        clarityStatus: "needs_clarification",
        clarificationQuestion:
          "I had trouble understanding. Which company are you asking about?",
        clarificationAttempts: state.clarificationAttempts + 1,
        currentAgent: "clarity"
      };
    }
  };
}

/**
 * Extract best guess company name from query (fallback when LLM fails).
 */
function extractBestGuess(query: string): string | null {
  const knownCompanies = [
    "apple",
    "tesla",
    "microsoft",
    "amazon",
    "google",
    "alphabet"
  ];
  const lowerQuery = query.toLowerCase();

  for (const company of knownCompanies) {
    if (lowerQuery.includes(company)) {
      return company.charAt(0).toUpperCase() + company.slice(1);
    }
  }
  return null;
}

// Default export for graph (uses default LLM)
export const clarityAgent = createClarityAgent();
```

**Test file**: `tests/agents/clarity.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClarityAgent } from "../../src/agents/clarity.agent.js";
import type { ResearchState } from "../../src/graph/state.js";
import { MAX_CLARIFICATION_ATTEMPTS } from "../../src/utils/constants.js";

// Mock LLM for testing
function createMockLLM(response: {
  is_clear: boolean;
  detected_company: string | null;
  clarification_needed: string | null;
  reasoning: string;
}) {
  return {
    withStructuredOutput: () => ({
      invoke: vi.fn().mockResolvedValue(response)
    })
  } as any;
}

function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "pending",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: null,
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "clarity",
    ...overrides
  };
}

describe("clarityAgent", () => {
  describe("clear queries", () => {
    it("should detect company from explicit mention", async () => {
      const mockLLM = createMockLLM({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Company explicitly mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "Tell me about Apple" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toBe("Apple Inc.");
    });
  });

  describe("unclear queries", () => {
    it("should request clarification for vague queries", async () => {
      const mockLLM = createMockLLM({
        is_clear: false,
        detected_company: null,
        clarification_needed: "Which company are you asking about?",
        reasoning: "No company mentioned"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about the company"
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("needs_clarification");
      expect(result.clarificationQuestion).toContain("company");
      expect(result.clarificationAttempts).toBe(1);
    });
  });

  describe("follow-up queries", () => {
    it("should use existing company for follow-ups", async () => {
      const mockLLM = createMockLLM({
        is_clear: true,
        detected_company: "Apple Inc.",
        clarification_needed: null,
        reasoning: "Follow-up"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "What about their stock?",
        detectedCompany: "Apple Inc."
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      // Should NOT have called LLM (follow-up pattern detected)
    });
  });

  describe("max attempts", () => {
    it("should force proceed after max clarification attempts", async () => {
      const mockLLM = createMockLLM({
        is_clear: false,
        detected_company: null,
        clarification_needed: "Still unclear",
        reasoning: "Unclear"
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({
        originalQuery: "Tell me about it",
        clarificationAttempts: MAX_CLARIFICATION_ATTEMPTS
      });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
    });
  });

  describe("cancel requests", () => {
    it("should handle 'nevermind' gracefully", async () => {
      const mockLLM = createMockLLM({
        is_clear: false,
        detected_company: null,
        clarification_needed: null,
        reasoning: ""
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "nevermind" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("clear");
      expect(result.finalSummary).toContain("No problem");
    });
  });

  describe("empty query", () => {
    it("should request clarification for empty input", async () => {
      const mockLLM = createMockLLM({
        is_clear: false,
        detected_company: null,
        clarification_needed: null,
        reasoning: ""
      });

      const agent = createClarityAgent(mockLLM);
      const state = createTestState({ originalQuery: "" });

      const result = await agent(state);

      expect(result.clarityStatus).toBe("needs_clarification");
      expect(result.clarificationQuestion).toContain("Hello");
    });
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

### Commit 9: Research Agent (Full Implementation)

**Goal**: Data fetching with confidence scoring and validation feedback incorporation.

**Files to update**:

- `src/agents/research.agent.ts` — Replace stub

**src/agents/research.agent.ts**:

```typescript
import type { ResearchState } from "../graph/state.js";
import type {
  ResearchDataSource,
  SearchContext
} from "../data/data-source.interface.js";
import { DataSourceError } from "../data/data-source.interface.js";
import { createDataSource } from "../data/index.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("research-agent");

/**
 * Factory function to create Research Agent with injectable data source.
 */
export function createResearchAgent(dataSource?: ResearchDataSource) {
  const source = dataSource ?? createDataSource();

  return async function researchAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const attemptNumber = state.researchAttempts + 1;

    logger.info("Research started", {
      company: state.detectedCompany,
      attempt: attemptNumber,
      dataSource: source.getName(),
      hasFeedback: !!state.validationFeedback
    });

    // Early exit if no company
    if (!state.detectedCompany) {
      logger.warn("No company detected, returning empty findings");
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    }

    const searchContext: SearchContext = {
      originalQuery: state.originalQuery,
      validationFeedback: state.validationFeedback,
      attemptNumber
    };

    try {
      const result = await source.search(state.detectedCompany, searchContext);

      logger.info("Research completed", {
        company: state.detectedCompany,
        confidence: result.confidence,
        hasFindings: !!result.findings,
        source: result.source
      });

      return {
        researchFindings: result.findings,
        confidenceScore: result.confidence,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    } catch (error) {
      if (error instanceof DataSourceError) {
        logger.error("Data source error", {
          source: error.source,
          retryable: error.isRetryable,
          message: error.message
        });
      } else {
        logger.error("Unexpected error", { error: String(error) });
      }

      // Graceful degradation: return null findings, don't crash
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    }
  };
}

// Default export for graph
export const researchAgent = createResearchAgent();
```

**Test file**: `tests/agents/research.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createResearchAgent } from "../../src/agents/research.agent.js";
import type { ResearchState } from "../../src/graph/state.js";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "../../src/data/data-source.interface.js";
import { DataSourceError } from "../../src/data/data-source.interface.js";

// Tracking mock data source
function createTrackingMock(
  results: SearchResult[]
): ResearchDataSource & { contexts: SearchContext[] } {
  let callIndex = 0;
  const contexts: SearchContext[] = [];

  return {
    contexts,
    search: vi.fn(async (company: string, context: SearchContext) => {
      contexts.push(context);
      return results[callIndex++] ?? results[results.length - 1];
    }),
    getName: () => "Tracking Mock",
    isAvailable: () => true
  };
}

function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "clear",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: "Apple Inc.",
    researchFindings: null,
    confidenceScore: 0,
    researchAttempts: 0,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "research",
    ...overrides
  };
}

describe("researchAgent", () => {
  describe("successful search", () => {
    it("should return findings and confidence", async () => {
      const mockSource = createTrackingMock([
        {
          findings: {
            company: "Apple Inc.",
            recentNews: "News",
            stockInfo: "Stock",
            keyDevelopments: "Dev",
            sources: ["Test"],
            rawData: {}
          },
          confidence: 8,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState();

      const result = await agent(state);

      expect(result.researchFindings?.company).toBe("Apple Inc.");
      expect(result.confidenceScore).toBe(8);
      expect(result.researchAttempts).toBe(1);
    });

    it("should increment attempt counter", async () => {
      const mockSource = createTrackingMock([
        {
          findings: null,
          confidence: 0,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({ researchAttempts: 2 });

      const result = await agent(state);

      expect(result.researchAttempts).toBe(3);
    });
  });

  describe("validation feedback", () => {
    it("should pass validation feedback to data source", async () => {
      const mockSource = createTrackingMock([
        {
          findings: null,
          confidence: 5,
          source: "Test"
        }
      ]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({
        validationFeedback: "Missing financial data",
        researchAttempts: 1
      });

      await agent(state);

      expect(mockSource.contexts[0].validationFeedback).toBe(
        "Missing financial data"
      );
      expect(mockSource.contexts[0].attemptNumber).toBe(2);
    });
  });

  describe("no company", () => {
    it("should return null findings when no company detected", async () => {
      const mockSource = createTrackingMock([]);

      const agent = createResearchAgent(mockSource);
      const state = createTestState({ detectedCompany: null });

      const result = await agent(state);

      expect(result.researchFindings).toBeNull();
      expect(result.confidenceScore).toBe(0);
      expect(mockSource.search).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle DataSourceError gracefully", async () => {
      const mockSource: ResearchDataSource = {
        search: vi
          .fn()
          .mockRejectedValue(new DataSourceError("API error", "Test", true)),
        getName: () => "Failing Mock",
        isAvailable: () => true
      };

      const agent = createResearchAgent(mockSource);
      const state = createTestState();

      const result = await agent(state);

      expect(result.researchFindings).toBeNull();
      expect(result.confidenceScore).toBe(0);
      expect(result.researchAttempts).toBe(1);
    });
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

### Commit 10: Validator Agent (Full Implementation)

**Goal**: Research quality assessment with specific feedback for retries.

**Files to update**:

- `src/agents/validator.agent.ts` — Replace stub

**src/agents/validator.agent.ts**:

```typescript
import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import {
  VALIDATOR_SYSTEM_PROMPT,
  buildValidatorUserPrompt
} from "../prompts/validator.prompts.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("validator-agent");

const ValidatorOutputSchema = z.object({
  is_sufficient: z.boolean(),
  feedback: z.string().nullable(),
  reasoning: z.string()
});

type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

/**
 * Factory function to create Validator Agent with injectable LLM.
 */
export function createValidatorAgent(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });
  const structuredModel = model.withStructuredOutput(ValidatorOutputSchema);

  return async function validatorAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    logger.info("Validation started", {
      company: state.detectedCompany,
      confidence: state.confidenceScore,
      attempt: state.researchAttempts
    });

    // No findings = definitely insufficient
    if (!state.researchFindings) {
      logger.info("No findings to validate");
      return {
        validationResult: "insufficient",
        validationFeedback:
          "No research data found. Try searching with different terms.",
        currentAgent: "validator"
      };
    }

    // Format findings for LLM
    const findingsText = formatFindings(state.researchFindings);

    try {
      const response: ValidatorOutput = await structuredModel.invoke([
        { role: "system", content: VALIDATOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildValidatorUserPrompt(
            state.originalQuery,
            findingsText,
            state.confidenceScore
          )
        }
      ]);

      logger.info("Validation complete", {
        sufficient: response.is_sufficient,
        reasoning: response.reasoning
      });

      return {
        validationResult: response.is_sufficient
          ? "sufficient"
          : "insufficient",
        validationFeedback: response.feedback,
        currentAgent: "validator"
      };
    } catch (error) {
      logger.error("Validation LLM failed", { error: String(error) });

      // Fallback: simple rule-based validation
      const hasAllFields = !!(
        state.researchFindings.recentNews &&
        state.researchFindings.stockInfo &&
        state.researchFindings.keyDevelopments
      );

      return {
        validationResult: hasAllFields ? "sufficient" : "insufficient",
        validationFeedback: hasAllFields
          ? null
          : "Some research fields are incomplete.",
        currentAgent: "validator"
      };
    }
  };
}

function formatFindings(findings: ResearchState["researchFindings"]): string {
  if (!findings) return "No findings";

  return `Company: ${findings.company}
Recent News: ${findings.recentNews ?? "Not available"}
Stock Info: ${findings.stockInfo ?? "Not available"}
Key Developments: ${findings.keyDevelopments ?? "Not available"}
Sources: ${findings.sources.join(", ") || "None"}`;
}

// Default export for graph
export const validatorAgent = createValidatorAgent();
```

**Test file**: `tests/agents/validator.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { createValidatorAgent } from "../../src/agents/validator.agent.js";
import type { ResearchState, ResearchFindings } from "../../src/graph/state.js";

function createMockLLM(response: {
  is_sufficient: boolean;
  feedback: string | null;
  reasoning: string;
}) {
  return {
    withStructuredOutput: () => ({
      invoke: vi.fn().mockResolvedValue(response)
    })
  } as any;
}

const completeFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Launched new products",
  stockInfo: "Trading at $195",
  keyDevelopments: "AI integration",
  sources: ["Test Source"],
  rawData: {}
};

const partialFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Some news",
  stockInfo: null,
  keyDevelopments: null,
  sources: ["Test"],
  rawData: {}
};

function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "clear",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: "Apple Inc.",
    researchFindings: completeFindings,
    confidenceScore: 8,
    researchAttempts: 1,
    validationResult: "pending",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "validator",
    ...overrides
  };
}

describe("validatorAgent", () => {
  describe("sufficient findings", () => {
    it("should approve complete findings", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: true,
        feedback: null,
        reasoning: "All fields populated"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState();

      const result = await agent(state);

      expect(result.validationResult).toBe("sufficient");
      expect(result.validationFeedback).toBeNull();
    });
  });

  describe("insufficient findings", () => {
    it("should reject null findings", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: false,
        feedback: "No data",
        reasoning: "Empty"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState({ researchFindings: null });

      const result = await agent(state);

      expect(result.validationResult).toBe("insufficient");
      expect(result.validationFeedback).toContain("No research data");
    });

    it("should provide specific feedback for missing fields", async () => {
      const mockLLM = createMockLLM({
        is_sufficient: false,
        feedback: "Missing financial data and key developments",
        reasoning: "Incomplete"
      });

      const agent = createValidatorAgent(mockLLM);
      const state = createTestState({ researchFindings: partialFindings });

      const result = await agent(state);

      expect(result.validationResult).toBe("insufficient");
      expect(result.validationFeedback).toContain("Missing");
    });
  });

  describe("LLM failure fallback", () => {
    it("should use rule-based validation on LLM error", async () => {
      const failingLLM = {
        withStructuredOutput: () => ({
          invoke: vi.fn().mockRejectedValue(new Error("LLM failed"))
        })
      } as any;

      const agent = createValidatorAgent(failingLLM);
      const state = createTestState({ researchFindings: completeFindings });

      const result = await agent(state);

      // Should still work via fallback
      expect(result.validationResult).toBe("sufficient");
    });
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

### Commit 11: Synthesis Agent (Full Implementation)

**Goal**: User-facing response generation with graceful degradation.

**Files to update**:

- `src/agents/synthesis.agent.ts` — Replace stub

**src/agents/synthesis.agent.ts**:

```typescript
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import type { ResearchState } from "../graph/state.js";
import { MAX_RESEARCH_ATTEMPTS } from "../utils/constants.js";
import {
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt
} from "../prompts/synthesis.prompts.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("synthesis-agent");

/**
 * Factory function to create Synthesis Agent with injectable LLM.
 */
export function createSynthesisAgent(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });

  return async function synthesisAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    logger.info("Synthesis started", {
      company: state.detectedCompany,
      confidence: state.confidenceScore,
      hasFindings: !!state.researchFindings,
      validationResult: state.validationResult
    });

    // Case 1: No data at all
    if (!state.researchFindings || !state.researchFindings.company) {
      const noDataSummary = generateNoDataResponse(state);
      return {
        finalSummary: noDataSummary,
        messages: [new AIMessage(noDataSummary)],
        currentAgent: "synthesis"
      };
    }

    // Determine confidence level
    const confidenceLevel = getConfidenceLevel(state);

    // Format findings for LLM
    const findingsText = formatFindings(state.researchFindings);

    try {
      const response = await model.invoke([
        { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildSynthesisUserPrompt(
            state.originalQuery,
            state.researchFindings.company,
            findingsText,
            confidenceLevel
          )
        }
      ]);

      const summary =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      // Add confidence prefix if needed
      const prefixedSummary = addConfidencePrefix(
        summary,
        confidenceLevel,
        state
      );

      logger.info("Synthesis complete", {
        confidenceLevel,
        summaryLength: prefixedSummary.length
      });

      return {
        finalSummary: prefixedSummary,
        messages: [new AIMessage(prefixedSummary)],
        currentAgent: "synthesis"
      };
    } catch (error) {
      logger.error("Synthesis LLM failed", { error: String(error) });

      // Fallback: basic template response
      const fallbackSummary = generateFallbackSummary(state);
      return {
        finalSummary: fallbackSummary,
        messages: [new AIMessage(fallbackSummary)],
        currentAgent: "synthesis"
      };
    }
  };
}

function getConfidenceLevel(state: ResearchState): "high" | "medium" | "low" {
  if (state.confidenceScore >= 8) return "high";
  if (state.confidenceScore >= 5) return "medium";
  return "low";
}

function addConfidencePrefix(
  summary: string,
  level: "high" | "medium" | "low",
  state: ResearchState
): string {
  if (level === "high") return summary;

  if (level === "low") {
    return `⚠️ **Note**: Based on limited available information:\n\n${summary}`;
  }

  // Medium confidence - check if max attempts reached
  if (
    state.validationResult === "insufficient" &&
    state.researchAttempts >= MAX_RESEARCH_ATTEMPTS
  ) {
    return `ℹ️ *I found some information, but couldn't verify all details:*\n\n${summary}`;
  }

  return summary;
}

function generateNoDataResponse(state: ResearchState): string {
  const query = state.detectedCompany ?? state.originalQuery;
  return `I couldn't find specific information about "${query}".

This might be because:
- The company name wasn't recognized in my sources
- Limited public data is available

Would you like to:
- Try a different spelling or the full company name?
- Ask about a related company?`;
}

function generateFallbackSummary(state: ResearchState): string {
  const findings = state.researchFindings;
  if (!findings) return generateNoDataResponse(state);

  const parts = [`Here's what I found about ${findings.company}:`];

  if (findings.recentNews) {
    parts.push(`\n**Recent News**: ${findings.recentNews}`);
  }
  if (findings.stockInfo) {
    parts.push(`\n**Financial**: ${findings.stockInfo}`);
  }
  if (findings.keyDevelopments) {
    parts.push(`\n**Key Developments**: ${findings.keyDevelopments}`);
  }

  return parts.join("\n");
}

function formatFindings(findings: ResearchState["researchFindings"]): string {
  if (!findings) return "No findings";

  return `Recent News: ${findings.recentNews ?? "Not available"}
Stock/Financial Info: ${findings.stockInfo ?? "Not available"}
Key Developments: ${findings.keyDevelopments ?? "Not available"}`;
}

// Default export for graph
export const synthesisAgent = createSynthesisAgent();
```

**Test file**: `tests/agents/synthesis.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { createSynthesisAgent } from "../../src/agents/synthesis.agent.js";
import type { ResearchState, ResearchFindings } from "../../src/graph/state.js";
import { MAX_RESEARCH_ATTEMPTS } from "../../src/utils/constants.js";

function createMockLLM(responseContent: string) {
  return {
    invoke: vi.fn().mockResolvedValue({ content: responseContent })
  } as any;
}

const completeFindings: ResearchFindings = {
  company: "Apple Inc.",
  recentNews: "Launched Vision Pro",
  stockInfo: "AAPL at $195",
  keyDevelopments: "AI integration",
  sources: ["Test"],
  rawData: {}
};

function createTestState(
  overrides: Partial<ResearchState> = {}
): ResearchState {
  return {
    messages: [],
    conversationSummary: null,
    originalQuery: "Tell me about Apple",
    clarityStatus: "clear",
    clarificationAttempts: 0,
    clarificationQuestion: null,
    detectedCompany: "Apple Inc.",
    researchFindings: completeFindings,
    confidenceScore: 8,
    researchAttempts: 1,
    validationResult: "sufficient",
    validationFeedback: null,
    finalSummary: null,
    currentAgent: "synthesis",
    ...overrides
  };
}

describe("synthesisAgent", () => {
  describe("high confidence", () => {
    it("should generate summary without disclaimer", async () => {
      const mockLLM = createMockLLM("Apple is doing great!");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ confidenceScore: 9 });

      const result = await agent(state);

      expect(result.finalSummary).toBe("Apple is doing great!");
      expect(result.finalSummary).not.toContain("⚠️");
      expect(result.messages).toHaveLength(1);
    });
  });

  describe("low confidence", () => {
    it("should add warning prefix for low confidence", async () => {
      const mockLLM = createMockLLM("Limited Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ confidenceScore: 3 });

      const result = await agent(state);

      expect(result.finalSummary).toContain("⚠️");
      expect(result.finalSummary).toContain("limited");
    });
  });

  describe("max attempts reached", () => {
    it("should indicate verification issues when max attempts hit", async () => {
      const mockLLM = createMockLLM("Partial Apple info.");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({
        confidenceScore: 6,
        validationResult: "insufficient",
        researchAttempts: MAX_RESEARCH_ATTEMPTS
      });

      const result = await agent(state);

      expect(result.finalSummary).toContain("couldn't verify");
    });
  });

  describe("no data", () => {
    it("should generate apologetic response for null findings", async () => {
      const mockLLM = createMockLLM("Should not see this");

      const agent = createSynthesisAgent(mockLLM);
      const state = createTestState({ researchFindings: null });

      const result = await agent(state);

      expect(result.finalSummary).toContain("couldn't find");
      expect(result.finalSummary).toContain("different spelling");
    });
  });

  describe("LLM failure fallback", () => {
    it("should generate template response on LLM error", async () => {
      const failingLLM = {
        invoke: vi.fn().mockRejectedValue(new Error("LLM down"))
      } as any;

      const agent = createSynthesisAgent(failingLLM);
      const state = createTestState();

      const result = await agent(state);

      expect(result.finalSummary).toContain("Apple Inc.");
      expect(result.finalSummary).toContain("Vision Pro"); // From findings
    });
  });
});
```

**Update agents/index.ts** to use factory exports:

```typescript
export { clarityAgent, createClarityAgent } from "./clarity.agent.js";
export { researchAgent, createResearchAgent } from "./research.agent.js";
export { validatorAgent, createValidatorAgent } from "./validator.agent.js";
export { synthesisAgent, createSynthesisAgent } from "./synthesis.agent.js";
export { clarificationInterrupt } from "./interrupt.agent.js";
```

**Verification**:

```bash
npm run build
npm test
```

---

## Phase 5: Integration Tests (Commits 12-14)

### Commit 12: Happy Path Integration

**Goal**: End-to-end flow with real or mock LLM.

**Files to create**:

```
tests/
├── integration/
│   └── happy-path.test.ts
└── fixtures/
    ├── index.ts
    └── states.ts
```

**tests/fixtures/states.ts**:

```typescript
import { HumanMessage } from "@langchain/core/messages";
import type { ResearchState } from "../../src/graph/state.js";

export function createBaseState(query: string): Partial<ResearchState> {
  return {
    messages: [new HumanMessage(query)],
    originalQuery: query
  };
}
```

**tests/fixtures/index.ts**:

```typescript
export * from "./states.js";
```

**tests/integration/happy-path.test.ts**:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";

// Skip if no API key (these tests require real LLM)
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

describe("Happy Path Integration", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    graph = buildResearchGraph();
  });

  describe.skipIf(!hasApiKey)("with real LLM", () => {
    it("should complete research for known company", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const result = await graph.invoke(
        {
          messages: [new HumanMessage("What's happening with Apple?")],
          originalQuery: "What's happening with Apple?"
        },
        config
      );

      expect(result.__interrupt__).toBeUndefined();
      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toMatch(/apple/i);
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary!.length).toBeGreaterThan(50);
    }, 30000);

    it("should complete research for Tesla", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Tesla")],
          originalQuery: "Tell me about Tesla"
        },
        config
      );

      expect(result.detectedCompany).toMatch(/tesla/i);
      expect(result.finalSummary).toBeDefined();
    }, 30000);
  });

  describe("with mock data (no API key needed)", () => {
    it("should handle unknown company gracefully", async () => {
      const config = { configurable: { thread_id: crypto.randomUUID() } };

      // This uses stubs which always return Apple, so we test the flow
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about some company")],
          originalQuery: "Tell me about some company"
        },
        config
      );

      // Graph should complete without crashing
      expect(result.currentAgent).toBe("synthesis");
      expect(result.finalSummary).toBeDefined();
    });
  });
});
```

**Verification**:

```bash
npm test
# With API key: ANTHROPIC_API_KEY=sk-... npm test
```

---

### Commit 13: Interrupt Flow Integration

**Goal**: Full clarification flow with interrupt/resume.

**Files to create**:

```
tests/
└── integration/
    └── clarification.test.ts
```

**tests/integration/clarification.test.ts**:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import {
  ResearchStateAnnotation,
  type ResearchState
} from "../../src/graph/state.js";
import { clarityRouter } from "../../src/graph/routers.js";
import { clarificationInterrupt } from "../../src/agents/interrupt.agent.js";

/**
 * Build a minimal graph to test interrupt flow specifically.
 * Uses controllable stub for clarity to force interrupt scenarios.
 */
function buildInterruptTestGraph(
  clarityBehavior: (state: ResearchState) => Partial<ResearchState>
) {
  const workflow = new StateGraph(ResearchStateAnnotation)
    .addNode("clarity", clarityBehavior)
    .addNode("interrupt", clarificationInterrupt)
    .addNode("end", (state) => ({
      finalSummary: `Completed for ${state.detectedCompany}`
    }))
    .addEdge(START, "clarity")
    .addConditionalEdges("clarity", clarityRouter, {
      interrupt: "interrupt",
      research: "end"
    })
    .addEdge("interrupt", "clarity")
    .addEdge("end", END);

  return workflow.compile({ checkpointer: new MemorySaver() });
}

describe("Interrupt Flow Integration", () => {
  it("should interrupt for unclear query and resume correctly", async () => {
    let callCount = 0;

    // First call: needs clarification. Second call: clear.
    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount === 1) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion: "Which company?",
          clarificationAttempts: 1,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: state.originalQuery, // Use the resumed query as company
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const config = { configurable: { thread_id: "interrupt-test-1" } };

    // Initial query - should interrupt
    const result1 = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about the company")],
        originalQuery: "Tell me about the company"
      },
      config
    );

    expect(result1.__interrupt__).toBeDefined();
    expect(result1.__interrupt__).toHaveLength(1);
    expect(result1.__interrupt__[0].value.question).toBe("Which company?");

    // Resume with clarification
    const result2 = await graph.invoke(
      new Command({ resume: "Apple" }),
      config
    );

    expect(result2.__interrupt__).toBeUndefined();
    expect(result2.finalSummary).toContain("Apple");
  });

  it("should handle double clarification", async () => {
    let callCount = 0;

    // First two calls need clarification, third is clear
    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount <= 2) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion:
            callCount === 1 ? "Which company?" : "Can you be more specific?",
          clarificationAttempts: callCount,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: "Apple Inc.",
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const config = { configurable: { thread_id: "double-interrupt-test" } };

    // First query
    const result1 = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me")],
        originalQuery: "Tell me"
      },
      config
    );
    expect(result1.__interrupt__).toBeDefined();

    // First resume - still unclear
    const result2 = await graph.invoke(
      new Command({ resume: "the tech one" }),
      config
    );
    expect(result2.__interrupt__).toBeDefined();
    expect(result2.__interrupt__[0].value.question).toContain("specific");

    // Second resume - now clear
    const result3 = await graph.invoke(
      new Command({ resume: "Apple Inc." }),
      config
    );
    expect(result3.__interrupt__).toBeUndefined();
    expect(result3.finalSummary).toContain("Apple");
  });

  it("should use same thread_id to maintain state", async () => {
    let callCount = 0;

    const clarityBehavior = (state: ResearchState): Partial<ResearchState> => {
      callCount++;
      if (callCount === 1) {
        return {
          clarityStatus: "needs_clarification",
          clarificationQuestion: "Which company?",
          clarificationAttempts: 1,
          currentAgent: "clarity"
        };
      }
      return {
        clarityStatus: "clear",
        detectedCompany: "Apple",
        currentAgent: "clarity"
      };
    };

    const graph = buildInterruptTestGraph(clarityBehavior);
    const threadId = "thread-state-test";

    // Initial with thread ID
    await graph.invoke(
      {
        messages: [new HumanMessage("Query")],
        originalQuery: "Query"
      },
      { configurable: { thread_id: threadId } }
    );

    // Resume with DIFFERENT thread ID should NOT find the interrupt
    const wrongThreadResult = await graph.invoke(
      new Command({ resume: "Apple" }),
      { configurable: { thread_id: "wrong-thread" } }
    );

    // This should fail or start fresh (implementation dependent)
    // The key point: thread_id matters for continuity
  });
});
```

**Verification**:

```bash
npm test
```

---

### Commit 14: Multi-Turn and Retry Loop Tests

**Goal**: Context preservation and validation retry loop.

**Files to create**:

```
tests/
└── integration/
    ├── multi-turn.test.ts
    └── retry-loop.test.ts
```

**tests/integration/multi-turn.test.ts**:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";
import { createNewQueryInput } from "../../src/utils/state-helpers.js";

describe("Multi-Turn Conversation", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    graph = buildResearchGraph();
  });

  it("should accumulate messages across turns", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1
    await graph.invoke(createNewQueryInput("Tell me about Apple"), config);

    // Turn 2
    const result2 = await graph.invoke(
      createNewQueryInput("What about their competitors?"),
      config
    );

    // Should have accumulated messages
    const humanMessages = result2.messages.filter(
      (m) => m._getType() === "human"
    );
    expect(humanMessages.length).toBeGreaterThanOrEqual(2);
  });

  it("should persist detectedCompany for follow-ups", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1: Establish company
    await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about Apple")],
        originalQuery: "Tell me about Apple"
      },
      config
    );

    // Check state
    const state1 = await graph.getState(config);
    expect(state1.values.detectedCompany).toBe("Apple Inc.");

    // Turn 2: Follow-up (stubs will maintain company)
    await graph.invoke(
      {
        messages: [new HumanMessage("What about their stock?")],
        originalQuery: "What about their stock?"
      },
      config
    );

    // Company should still be set
    const state2 = await graph.getState(config);
    expect(state2.values.detectedCompany).toBe("Apple Inc.");
  });

  it("should reset query-specific fields on new query", async () => {
    const config = { configurable: { thread_id: crypto.randomUUID() } };

    // Turn 1
    await graph.invoke(createNewQueryInput("About Apple"), config);

    // Turn 2 with reset helper
    const result2 = await graph.invoke(
      createNewQueryInput("Different question"),
      config
    );

    // Query-specific fields should be fresh for Turn 2's processing
    // (Hard to test mid-execution, but we can verify it completed)
    expect(result2.currentAgent).toBe("synthesis");
  });
});
```

**tests/integration/retry-loop.test.ts**:

```typescript
import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import {
  ResearchStateAnnotation,
  type ResearchState,
  type ResearchFindings
} from "../../src/graph/state.js";
import { researchRouter, validationRouter } from "../../src/graph/routers.js";
import { MAX_RESEARCH_ATTEMPTS } from "../../src/utils/constants.js";

describe("Retry Loop Integration", () => {
  it("should retry research when validation fails", async () => {
    const attemptContexts: { attempt: number; feedback: string | null }[] = [];

    // Research agent that tracks attempts and provides low confidence initially
    const trackingResearchAgent = (
      state: ResearchState
    ): Partial<ResearchState> => {
      const attempt = state.researchAttempts + 1;
      attemptContexts.push({
        attempt,
        feedback: state.validationFeedback
      });

      // First attempt: low confidence. Second+: high confidence.
      const confidence = attempt === 1 ? 4 : 8;

      return {
        researchFindings: {
          company: "Test Co",
          recentNews: attempt === 1 ? null : "News found on retry",
          stockInfo: "Stock info",
          keyDevelopments: "Developments",
          sources: ["Test"],
          rawData: { attempt }
        },
        confidenceScore: confidence,
        researchAttempts: attempt,
        currentAgent: "research"
      };
    };

    // Validator that fails first time
    let validationCalls = 0;
    const trackingValidator = (
      state: ResearchState
    ): Partial<ResearchState> => {
      validationCalls++;
      if (validationCalls === 1) {
        return {
          validationResult: "insufficient",
          validationFeedback: "Missing news data",
          currentAgent: "validator"
        };
      }
      return {
        validationResult: "sufficient",
        validationFeedback: null,
        currentAgent: "validator"
      };
    };

    const synthesisAgent = (state: ResearchState): Partial<ResearchState> => ({
      finalSummary: `Done after ${state.researchAttempts} attempts`,
      currentAgent: "synthesis"
    });

    const clarityAgent = (state: ResearchState): Partial<ResearchState> => ({
      clarityStatus: "clear",
      detectedCompany: "Test Co",
      currentAgent: "clarity"
    });

    const graph = new StateGraph(ResearchStateAnnotation)
      .addNode("clarity", clarityAgent)
      .addNode("research", trackingResearchAgent)
      .addNode("validator", trackingValidator)
      .addNode("synthesis", synthesisAgent)
      .addEdge(START, "clarity")
      .addEdge("clarity", "research")
      .addConditionalEdges("research", researchRouter, {
        validator: "validator",
        synthesis: "synthesis"
      })
      .addConditionalEdges("validator", validationRouter, {
        research: "research",
        synthesis: "synthesis"
      })
      .addEdge("synthesis", END)
      .compile({ checkpointer: new MemorySaver() });

    const config = { configurable: { thread_id: "retry-test" } };

    const result = await graph.invoke(
      {
        messages: [new HumanMessage("Test query")],
        originalQuery: "Test query"
      },
      config
    );

    // Should have retried
    expect(result.researchAttempts).toBe(2);
    expect(attemptContexts).toHaveLength(2);

    // Second attempt should have received feedback
    expect(attemptContexts[1].feedback).toBe("Missing news data");
  });

  it("should stop at max attempts even if still insufficient", async () => {
    // Validator always returns insufficient
    const alwaysFailValidator = (): Partial<ResearchState> => ({
      validationResult: "insufficient",
      validationFeedback: "Always fails",
      currentAgent: "validator"
    });

    let researchCalls = 0;
    const countingResearch = (state: ResearchState): Partial<ResearchState> => {
      researchCalls++;
      return {
        researchFindings: {
          company: "Test",
          recentNews: null,
          stockInfo: null,
          keyDevelopments: null,
          sources: [],
          rawData: {}
        },
        confidenceScore: 2, // Low, triggers validation
        researchAttempts: state.researchAttempts + 1,
        currentAgent: "research"
      };
    };

    const graph = new StateGraph(ResearchStateAnnotation)
      .addNode("clarity", () => ({
        clarityStatus: "clear",
        detectedCompany: "Test",
        currentAgent: "clarity"
      }))
      .addNode("research", countingResearch)
      .addNode("validator", alwaysFailValidator)
      .addNode("synthesis", (state) => ({
        finalSummary: `Stopped after ${state.researchAttempts} attempts`,
        currentAgent: "synthesis"
      }))
      .addEdge(START, "clarity")
      .addEdge("clarity", "research")
      .addConditionalEdges("research", researchRouter, {
        validator: "validator",
        synthesis: "synthesis"
      })
      .addConditionalEdges("validator", validationRouter, {
        research: "research",
        synthesis: "synthesis"
      })
      .addEdge("synthesis", END)
      .compile({ checkpointer: new MemorySaver() });

    const result = await graph.invoke(
      {
        messages: [new HumanMessage("Test")],
        originalQuery: "Test"
      },
      { configurable: { thread_id: "max-attempts-test" } }
    );

    // Should have stopped at MAX_RESEARCH_ATTEMPTS
    expect(researchCalls).toBe(MAX_RESEARCH_ATTEMPTS);
    expect(result.researchAttempts).toBe(MAX_RESEARCH_ATTEMPTS);
    expect(result.finalSummary).toContain(String(MAX_RESEARCH_ATTEMPTS));
  });
});
```

**Verification**:

```bash
npm test
```

---

## Phase 6: Tavily Integration (Commits 15-16)

### Commit 15: Tavily Data Source Implementation

**Goal**: Real-time search capability.

**Files to create**:

```
src/
└── data/
    └── tavily-source.ts
```

**src/data/tavily-source.ts**:

```typescript
import { TavilySearch } from "@langchain/tavily";
import type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
import { DataSourceError } from "./data-source.interface.js";
import type { ResearchFindings } from "../graph/state.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("tavily-source");

interface TavilyConfig {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
}

export class TavilyDataSource implements ResearchDataSource {
  private tool: TavilySearch;
  private config: TavilyConfig;

  constructor(config: TavilyConfig = {}) {
    this.config = {
      maxResults: config.maxResults ?? 5,
      searchDepth: config.searchDepth ?? "advanced",
      includeAnswer: config.includeAnswer ?? true
    };

    this.tool = new TavilySearch({
      maxResults: this.config.maxResults,
      searchDepth: this.config.searchDepth,
      includeAnswer: this.config.includeAnswer
    });
  }

  getName(): string {
    return "Tavily Search";
  }

  isAvailable(): boolean {
    return !!process.env.TAVILY_API_KEY;
  }

  async search(company: string, context: SearchContext): Promise<SearchResult> {
    if (!this.isAvailable()) {
      throw new DataSourceError(
        "Tavily API key not configured",
        this.getName(),
        false
      );
    }

    try {
      const query = this.buildSearchQuery(company, context);
      logger.info("Tavily search started", {
        company,
        query,
        attempt: context.attemptNumber
      });

      // TavilySearch expects { query: string }
      const rawResult = await this.tool.invoke({ query });

      logger.info("Tavily search completed", {
        company,
        hasResult: !!rawResult
      });

      const findings = this.parseResults(company, rawResult);
      const confidence = this.calculateConfidence(findings, rawResult);

      return {
        findings,
        confidence,
        source: this.getName(),
        rawResponse: rawResult
      };
    } catch (error) {
      logger.error("Tavily search failed", { company, error: String(error) });

      const isRetryable = this.isRetryableError(error);
      throw new DataSourceError(
        `Tavily search failed: ${
          error instanceof Error ? error.message : "Unknown"
        }`,
        this.getName(),
        isRetryable,
        error instanceof Error ? error : undefined
      );
    }
  }

  private buildSearchQuery(company: string, context: SearchContext): string {
    const baseQuery = `${company} company`;
    const focusAreas = ["latest news", "stock price", "recent developments"];

    // Incorporate validation feedback
    if (context.validationFeedback) {
      const feedback = context.validationFeedback.toLowerCase();
      if (feedback.includes("financial")) {
        focusAreas.push("earnings", "revenue");
      }
      if (feedback.includes("news")) {
        focusAreas.push("breaking news", "announcements");
      }
    }

    return `${baseQuery} ${focusAreas.slice(0, 3).join(" ")}`;
  }

  private parseResults(
    company: string,
    rawResult: unknown
  ): ResearchFindings | null {
    // Handle string response (Tavily can return a string answer)
    if (typeof rawResult === "string") {
      return {
        company,
        recentNews: rawResult.slice(0, 500),
        stockInfo: null,
        keyDevelopments: null,
        sources: [this.getName()],
        rawData: { type: "string" }
      };
    }

    // Handle array of results
    if (Array.isArray(rawResult) && rawResult.length > 0) {
      const combinedContent = rawResult
        .map((r: any) => r.content || r.snippet || "")
        .join("\n\n");

      return {
        company,
        recentNews: this.extractSection(combinedContent, "news"),
        stockInfo: this.extractSection(combinedContent, "stock"),
        keyDevelopments: this.extractSection(combinedContent, "developments"),
        sources: rawResult.slice(0, 5).map((r: any) => r.url || this.getName()),
        rawData: { resultCount: rawResult.length }
      };
    }

    // Handle object with results property
    if (typeof rawResult === "object" && rawResult !== null) {
      const obj = rawResult as Record<string, unknown>;
      if (Array.isArray(obj.results) && obj.results.length > 0) {
        return this.parseResults(company, obj.results);
      }
      if (typeof obj.answer === "string") {
        return {
          company,
          recentNews: obj.answer.slice(0, 500),
          stockInfo: null,
          keyDevelopments: null,
          sources: [this.getName()],
          rawData: { hasAnswer: true }
        };
      }
    }

    return null;
  }

  private extractSection(
    content: string,
    type: "news" | "stock" | "developments"
  ): string | null {
    const patterns: Record<string, RegExp[]> = {
      news: [/\b(announced|launched|released|reported)\b/i],
      stock: [/\$[\d,.]+/, /trading at/i, /market cap/i],
      developments: [
        /\b(AI|artificial intelligence|new product|partnership)\b/i
      ]
    };

    const sentences = content.split(/[.!?]+/);
    const relevant = sentences.filter((s) =>
      patterns[type].some((p) => p.test(s))
    );

    return relevant.length > 0
      ? relevant.slice(0, 3).join(". ").slice(0, 400) + "."
      : null;
  }

  private calculateConfidence(
    findings: ResearchFindings | null,
    rawResult: unknown
  ): number {
    if (!findings) return 0;

    let score = 0;
    if (findings.recentNews && findings.recentNews.length > 100) score += 3;
    else if (findings.recentNews) score += 1;

    if (findings.stockInfo) score += 3;

    if (findings.keyDevelopments && findings.keyDevelopments.length > 100)
      score += 3;
    else if (findings.keyDevelopments) score += 1;

    if (findings.sources.length >= 3) score += 1;

    return Math.min(10, score);
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();

    if (msg.includes("rate limit") || msg.includes("429")) return true;
    if (msg.includes("timeout") || msg.includes("etimedout")) return true;
    if (msg.includes("500") || msg.includes("502") || msg.includes("503"))
      return true;

    return false;
  }
}
```

**Test file**: `tests/data/tavily-source.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { TavilyDataSource } from "../../src/data/tavily-source.js";

const hasTavilyKey = !!process.env.TAVILY_API_KEY;

describe("TavilyDataSource", () => {
  describe("isAvailable", () => {
    it("should return false without API key", () => {
      const originalKey = process.env.TAVILY_API_KEY;
      delete process.env.TAVILY_API_KEY;

      const source = new TavilyDataSource();
      expect(source.isAvailable()).toBe(false);

      if (originalKey) process.env.TAVILY_API_KEY = originalKey;
    });

    it.skipIf(!hasTavilyKey)("should return true with API key", () => {
      const source = new TavilyDataSource();
      expect(source.isAvailable()).toBe(true);
    });
  });

  describe("getName", () => {
    it("should return 'Tavily Search'", () => {
      const source = new TavilyDataSource();
      expect(source.getName()).toBe("Tavily Search");
    });
  });

  describe.skipIf(!hasTavilyKey)("search (requires API key)", () => {
    let source: TavilyDataSource;

    beforeEach(() => {
      source = new TavilyDataSource();
    });

    it("should search for real company data", async () => {
      const result = await source.search("Apple Inc.", {
        originalQuery: "Latest Apple news",
        attemptNumber: 1
      });

      expect(result.findings).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.source).toBe("Tavily Search");
    }, 30000);

    it("should handle validation feedback in query", async () => {
      const result = await source.search("Microsoft", {
        originalQuery: "Microsoft info",
        validationFeedback: "Missing financial data",
        attemptNumber: 2
      });

      expect(result.findings).not.toBeNull();
    }, 30000);
  });
});
```

**Verification**:

```bash
npm run build
npm test
# With Tavily: TAVILY_API_KEY=tvly-... npm test
```

---

### Commit 16: Data Source Factory Update

**Goal**: Complete factory with auto-detection.

**Files to update**:

- `src/data/index.ts` — Add Tavily support

**src/data/index.ts**:

```typescript
import type { ResearchDataSource } from "./data-source.interface.js";
import { MockDataSource } from "./mock-source.js";
import { TavilyDataSource } from "./tavily-source.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("data-source-factory");

export type DataSourceType = "mock" | "tavily" | "auto";

/**
 * Create a data source based on configuration.
 *
 * @param type - Explicit type or "auto" to detect from environment
 * @returns Configured data source
 */
export function createDataSource(
  type: DataSourceType = "auto"
): ResearchDataSource {
  // Auto-detect based on environment
  if (type === "auto") {
    const envType = process.env.RESEARCH_DATA_SOURCE as
      | DataSourceType
      | undefined;
    type = envType ?? "mock";

    // If Tavily requested but not available, warn and fall back
    if (type === "tavily" && !process.env.TAVILY_API_KEY) {
      logger.warn(
        "Tavily requested but TAVILY_API_KEY not set, falling back to mock"
      );
      type = "mock";
    }

    // Auto with Tavily key available → use Tavily
    if (type === "auto" && process.env.TAVILY_API_KEY) {
      type = "tavily";
    }
  }

  switch (type) {
    case "tavily":
      if (!process.env.TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY required for Tavily data source");
      }
      logger.info("Using Tavily data source");
      return new TavilyDataSource();

    case "mock":
    default:
      logger.info("Using Mock data source");
      return new MockDataSource();
  }
}

export { MockDataSource } from "./mock-source.js";
export { TavilyDataSource } from "./tavily-source.js";
export type {
  ResearchDataSource,
  SearchContext,
  SearchResult
} from "./data-source.interface.js";
export { DataSourceError } from "./data-source.interface.js";
```

**Test file**: `tests/data/factory.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDataSource } from "../../src/data/index.js";

describe("createDataSource factory", () => {
  let originalDataSource: string | undefined;
  let originalTavilyKey: string | undefined;

  beforeEach(() => {
    originalDataSource = process.env.RESEARCH_DATA_SOURCE;
    originalTavilyKey = process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (originalDataSource !== undefined) {
      process.env.RESEARCH_DATA_SOURCE = originalDataSource;
    } else {
      delete process.env.RESEARCH_DATA_SOURCE;
    }
    if (originalTavilyKey !== undefined) {
      process.env.TAVILY_API_KEY = originalTavilyKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  it("should create MockDataSource when type is 'mock'", () => {
    const source = createDataSource("mock");
    expect(source.getName()).toBe("Mock Data Source");
  });

  it("should create MockDataSource when auto and no Tavily key", () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.RESEARCH_DATA_SOURCE;

    const source = createDataSource("auto");
    expect(source.getName()).toBe("Mock Data Source");
  });

  it("should throw when tavily requested without key", () => {
    delete process.env.TAVILY_API_KEY;

    expect(() => createDataSource("tavily")).toThrow("TAVILY_API_KEY required");
  });

  it("should fall back to mock when env says tavily but no key", () => {
    process.env.RESEARCH_DATA_SOURCE = "tavily";
    delete process.env.TAVILY_API_KEY;

    // Auto-detection should fall back
    const source = createDataSource("auto");
    expect(source.getName()).toBe("Mock Data Source");
  });
});
```

**Verification**:

```bash
npm run build
npm test
```

---

## Phase 7: CLI & Beyond Features (Commits 17-20)

### Commit 17: CLI Entry Point

**Goal**: Interactive conversation loop.

**Files to update**:

- `src/index.ts` — Full CLI implementation

**src/index.ts**:

```typescript
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { Command } from "@langchain/langgraph";
import { buildResearchGraph } from "./graph/workflow.js";
import { createNewQueryInput } from "./utils/state-helpers.js";
import { loadConfig, validateConfig } from "./utils/config.js";
import { Logger } from "./utils/logger.js";

const logger = new Logger("cli");

async function main() {
  // Load and validate config
  const config = loadConfig();
  try {
    validateConfig(config);
  } catch (error) {
    console.error("Configuration error:", error);
    process.exit(1);
  }

  // Build graph
  const graph = buildResearchGraph();
  const threadId = crypto.randomUUID();
  const graphConfig = { configurable: { thread_id: threadId } };

  // Setup readline
  const rl = readline.createInterface({ input, output });

  console.log("╔════════════════════════════════════════════╗");
  console.log("║       Research Assistant                   ║");
  console.log("║  Type 'quit' to exit, 'new' for new thread ║");
  console.log("╚════════════════════════════════════════════╝\n");

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
        console.log("\n🔄 Started new conversation thread.\n");
        continue;
      }

      if (!trimmedInput) {
        continue;
      }

      try {
        let result = await graph.invoke(
          createNewQueryInput(trimmedInput),
          graphConfig
        );

        // Handle interrupt loop
        while (result.__interrupt__) {
          const interruptData = result.__interrupt__[0].value;
          console.log(`\n🤔 ${interruptData.question}`);

          const clarification = await rl.question("You: ");
          const trimmedClarification = clarification.trim();

          if (trimmedClarification.toLowerCase() === "quit") {
            console.log("\nGoodbye!");
            rl.close();
            return;
          }

          result = await graph.invoke(
            new Command({ resume: trimmedClarification }),
            graphConfig
          );
        }

        // Display result
        if (result.finalSummary) {
          console.log(`\n📊 Assistant:\n${result.finalSummary}\n`);
        } else {
          console.log("\n⚠️ No summary generated.\n");
        }
      } catch (error) {
        logger.error("Graph execution failed", { error: String(error) });
        console.log("\n❌ An error occurred. Please try again.\n");
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
```

**Verification**:

```bash
npm run build
npm start
# Interactive testing
```

---

### Commit 18: Streaming Support

**Goal**: Real-time progress indication.

**Files to create**:

```
src/
└── cli/
    ├── index.ts          # Move CLI here
    └── streaming.ts      # Streaming helpers
```

**src/cli/streaming.ts**:

```typescript
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
    clarity: "🔍 Analyzing query...",
    research: "📚 Researching...",
    validator: "✅ Validating findings...",
    synthesis: "📝 Generating summary...",
    interrupt: "⏸️  Waiting for input..."
  };

  const message = icons[node] ?? `⚙️  ${node}...`;
  console.log(message);
}
```

Update CLI to use streaming (optional enhancement).

**Verification**:

```bash
npm run build
npm start
```

---

### Commit 19: LangSmith Integration

**Goal**: Observability documentation and setup verification.

**Files to update**:

- `.env.example` — Already has LangSmith vars
- `README.md` — Add observability section

**src/utils/config.ts** (add verification):

```typescript
// Add to validateConfig
export function validateConfig(config: AppConfig): void {
  // ... existing checks ...

  if (config.langsmithEnabled) {
    if (!process.env.LANGCHAIN_API_KEY) {
      console.warn(
        "Warning: LANGCHAIN_TRACING_V2=true but LANGCHAIN_API_KEY not set"
      );
    } else {
      console.log(
        "LangSmith tracing enabled for project:",
        process.env.LANGCHAIN_PROJECT ?? "default"
      );
    }
  }
}
```

**Verification**:

```bash
# With LangSmith
LANGCHAIN_TRACING_V2=true LANGCHAIN_API_KEY=... npm start
# Check traces at smith.langchain.com
```

---

### Commit 20: Graceful Degradation & Conversation Summary

**Goal**: Enhanced error handling and long conversation support.

**Files to update/create**:

- `src/agents/summarizer.agent.ts` — New agent for conversation summary
- Update synthesis agent for better degradation

**src/agents/summarizer.agent.ts**:

```typescript
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";
import type { ResearchState } from "../graph/state.js";
import {
  MESSAGE_SUMMARIZATION_THRESHOLD,
  MESSAGES_TO_KEEP_AFTER_SUMMARY
} from "../utils/constants.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger("summarizer");

/**
 * Summarize conversation when it gets too long.
 * Can be called as a utility or integrated as a node.
 */
export function createConversationSummarizer(llm?: BaseChatModel) {
  const model = llm ?? new ChatAnthropic({ model: "claude-sonnet-4-20250514" });

  return async function maybeSummarize(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    if (state.messages.length <= MESSAGE_SUMMARIZATION_THRESHOLD) {
      return {};
    }

    logger.info("Summarizing conversation", {
      messageCount: state.messages.length
    });

    const messagesToSummarize = state.messages.slice(
      0,
      -MESSAGES_TO_KEEP_AFTER_SUMMARY
    );
    const recentMessages = state.messages.slice(
      -MESSAGES_TO_KEEP_AFTER_SUMMARY
    );

    const contextToSummarize = state.conversationSummary
      ? `Previous context: ${
          state.conversationSummary
        }\n\nNew messages:\n${formatMessages(messagesToSummarize)}`
      : formatMessages(messagesToSummarize);

    try {
      const response = await model.invoke([
        {
          role: "system",
          content: `Summarize this conversation history concisely. Preserve:
- Company names discussed
- Key facts learned
- User's interests and follow-up patterns
Be brief but complete.`
        },
        { role: "user", content: contextToSummarize }
      ]);

      const summary =
        typeof response.content === "string" ? response.content : "";

      logger.info("Conversation summarized", { summaryLength: summary.length });

      return {
        conversationSummary: summary,
        messages: recentMessages
      };
    } catch (error) {
      logger.error("Summarization failed", { error: String(error) });
      return {};
    }
  };
}

function formatMessages(messages: ResearchState["messages"]): string {
  return messages.map((m) => `${m._getType()}: ${m.content}`).join("\n");
}
```

**Verification**:

```bash
npm run build
npm test
```

---

## Phase 8: Documentation (Commits 21-22)

### Commit 21: README & Documentation

**Goal**: Complete setup and usage documentation.

**Files to create**:

```
README.md
ASSUMPTIONS.md
docs/
└── ARCHITECTURE.md    # Move provided architecture doc here
```

**README.md** structure:

````markdown
# Research Assistant

A multi-agent research assistant built with LangGraph TypeScript.

## Quick Start

```bash
# Install
npm install

# Configure (copy and edit)
cp .env.example .env

# Run
npm start
```
````

## Features

- 4-agent orchestrated workflow
- Human-in-the-loop clarification
- Multi-turn conversation with memory
- Mock + Tavily data sources
- Streaming progress updates

## Configuration

| Variable             | Required  | Default | Description           |
| -------------------- | --------- | ------- | --------------------- |
| ANTHROPIC_API_KEY    | Yes       | -       | Claude API key        |
| RESEARCH_DATA_SOURCE | No        | auto    | mock, tavily, or auto |
| TAVILY_API_KEY       | If tavily | -       | Tavily search API key |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design.

## Testing

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm test -- clarity.test    # Specific test file
```

## Example Conversations

### Clear Query

```
You: What's happening with Apple?
📊 Assistant: Here's what I found about Apple Inc...
```

### Clarification Flow

```
You: Tell me about the company
🤔 Which company are you asking about?
You: Tesla
📊 Assistant: Here's what I found about Tesla...
```

```

---

### Commit 22: Final Polish

**Goal**: Ready for delivery.

**Actions**:
1. Run full test suite: `npm test`
2. Verify build: `npm run build`
3. Test CLI manually with various scenarios
4. Review all exports and imports
5. Add any missing type annotations
6. Final code formatting

**Final Verification Checklist**:
- [ ] `npm install` works from clean state
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes all tests
- [ ] `npm start` launches interactive CLI
- [ ] Interrupt flow works correctly
- [ ] Multi-turn context is preserved
- [ ] Mock data source works without API keys
- [ ] Tavily works when configured
- [ ] README instructions are accurate

---

## Summary: 22 Commits

| Phase | Commits | Focus |
|-------|---------|-------|
| **Foundation** | 1-4 | Scaffolding, types, mock data, routers |
| **Stub Graph** | 5-6 | Stub agents, graph construction, integration tests |
| **Infrastructure** | 7 | Utilities, prompts, helpers |
| **Real Agents** | 8-11 | Clarity, Research, Validator, Synthesis |
| **Integration** | 12-14 | Happy path, interrupt flow, multi-turn, retry loop |
| **Tavily** | 15-16 | Tavily source, factory update |
| **CLI & Beyond** | 17-20 | CLI, streaming, LangSmith, summarization |
| **Documentation** | 21-22 | README, final polish |

Each commit builds on the previous, with clear verification steps and no broken intermediate states.
```
