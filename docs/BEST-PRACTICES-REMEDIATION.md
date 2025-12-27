# Best Practices Remediation Plan

This document provides a detailed commit-by-commit plan to address all issues identified in the LangGraph best practices evaluation.

## Overview

| Priority | Commits | Issues Addressed |
|----------|---------|------------------|
| P1 (Critical) | 1-3 | Error wrapping, retry implementation, error context |
| P2 (Important) | 4-6 | Silent failures, error detection, logging |
| P3 (Polish) | 7-9 | Constants, type safety, code quality |

**Total: 9 commits**

---

## Commit 1: Implement Node Error Wrapper

**Severity**: HIGH
**Files to modify**:
- `src/utils/error-wrapper.ts` (new)
- `src/graph/workflow.ts`

### Problem
Unhandled exceptions in agents crash the entire graph. The `errorContext` state field exists but is never populated automatically.

### Implementation

1. Create `src/utils/error-wrapper.ts`:

```typescript
import { ResearchState } from "../graph/state";
import { ErrorContext } from "../graph/state";
import { AgentName } from "../types/agent";
import { createLoggerWithCorrelationId } from "./logger";

type AgentFunction = (state: ResearchState) => Promise<Partial<ResearchState>>;

export function withErrorHandling(
  agentName: AgentName,
  agentFn: AgentFunction
): AgentFunction {
  return async (state: ResearchState): Promise<Partial<ResearchState>> => {
    const logger = createLoggerWithCorrelationId(agentName, state.correlationId);

    try {
      return await agentFn(state);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable = isRetryableError(error);

      logger.error("Agent failed with unhandled error", {
        agentName,
        errorMessage,
        isRetryable,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorContext: ErrorContext = {
        failedNode: agentName,
        errorMessage,
        isRetryable,
        originalError: error,
      };

      return {
        errorContext,
        currentAgent: agentName,
      };
    }
  };
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("503")
    );
  }
  return false;
}
```

2. Update `src/graph/workflow.ts` to wrap all agents:

```typescript
import { withErrorHandling } from "../utils/error-wrapper";

// In buildResearchWorkflow():
.addNode("clarity", withErrorHandling("clarity", clarityAgent))
.addNode("research", withErrorHandling("research", researchAgent))
.addNode("validator", withErrorHandling("validator", validatorAgent))
.addNode("synthesis", withErrorHandling("synthesis", synthesisAgent))
// Note: interrupt and error-recovery should NOT be wrapped
```

### Tests to update
- `tests/integration/error-scenarios.test.ts` - Remove manual `errorContext` setup
- Add `tests/utils/error-wrapper.test.ts`

### Commit message
```
feat(utils): add automatic node error wrapper

- Create withErrorHandling() wrapper for agents
- Automatically populate errorContext on unhandled exceptions
- Include stack traces in error logging
- Determine retryability based on error type
- Wrap all main agents in workflow.ts

Closes #XXX
```

---

## Commit 2: Implement Retry Logic with p-retry

**Severity**: HIGH
**Files to modify**:
- `src/utils/retry.ts` (rewrite)
- `src/data/tavily-source.ts`
- `src/agents/research.agent.ts`

### Problem
`p-retry` is declared as a dependency but never used. Retry predicates exist but are not called anywhere.

### Implementation

1. Rewrite `src/utils/retry.ts`:

```typescript
import pRetry, { AbortError } from "p-retry";
import { createLoggerWithCorrelationId } from "./logger";

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  correlationId?: string | null;
  operation?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "correlationId" | "operation">> = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 10000,
};

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check structured error properties first
  const anyError = error as Record<string, unknown>;
  if (typeof anyError.status === "number") {
    const status = anyError.status;
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }
  }
  if (typeof anyError.code === "string") {
    const code = anyError.code;
    if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EPIPE"].includes(code)) {
      return true;
    }
  }

  // Fallback to message matching
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("network")
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLoggerWithCorrelationId(
    opts.operation ?? "retry",
    opts.correlationId ?? null
  );

  return pRetry(fn, {
    retries: opts.retries,
    minTimeout: opts.minTimeout,
    maxTimeout: opts.maxTimeout,
    onFailedAttempt: (error) => {
      if (!isRetryableError(error)) {
        throw new AbortError(error.message);
      }
      logger.warn("Retry attempt failed", {
        attempt: error.attemptNumber,
        retriesLeft: error.retriesLeft,
        error: error.message,
      });
    },
  });
}
```

2. Update `src/data/tavily-source.ts` to use retry:

```typescript
import { withRetry } from "../utils/retry";

// In search() method:
const result = await withRetry(
  () => tavilyCircuitBreaker.execute(async () => {
    return await this.client.search(query, { ... });
  }),
  {
    retries: 2,
    correlationId: context.correlationId,
    operation: "tavily-search",
  }
);
```

### Tests to add
- `tests/utils/retry.test.ts` - Test retry behavior, abort on non-retryable

### Commit message
```
feat(utils): implement retry logic with p-retry

- Rewrite retry.ts to use p-retry library
- Check structured error properties (status, code) before message
- Add withRetry() wrapper with exponential backoff
- Integrate retry with Tavily data source
- Abort immediately on non-retryable errors
```

---

## Commit 3: Clean Up Unused Retry Predicates

**Severity**: LOW (cleanup after Commit 2)
**Files to modify**:
- `src/utils/retry.ts`

### Problem
Old retry predicates (`isRateLimitError`, `isNetworkError`, etc.) are now superseded by unified `isRetryableError`.

### Implementation
Remove the following unused functions:
- `isRateLimitError()`
- `isNetworkError()`
- `isTimeoutError()`
- `isServerError()`
- `isTransientError()`

Keep only `isRetryableError()` and `withRetry()`.

### Commit message
```
refactor(utils): remove deprecated retry predicates

- Remove unused isRateLimitError, isNetworkError, etc.
- Consolidate all logic into isRetryableError()
- Clean up exports
```

---

## Commit 4: Fix Silent Failures in Interrupt Handling

**Severity**: MEDIUM
**Files to modify**:
- `src/utils/streaming.ts`
- `src/types/interrupt.ts`

### Problem
Invalid interrupt data returns `false` silently, masking real bugs.

### Implementation

1. Update `src/utils/streaming.ts`:

```typescript
// Change from:
if (!isInterruptData(data)) {
  return { interrupted: false, interruptData: undefined };
}

// To:
if (!isInterruptData(data)) {
  logger.warn("Invalid interrupt data structure detected", {
    receivedType: typeof data,
    hasType: data && typeof data === "object" && "type" in data,
  });
  return { interrupted: false, interruptData: undefined };
}
```

2. Update `src/types/interrupt.ts` to add detailed validation logging:

```typescript
export function validateInterruptData(
  data: unknown,
  logger?: Logger
): ClarificationInterruptPayload | null {
  const result = ClarificationInterruptPayloadSchema.safeParse(data);
  if (!result.success) {
    logger?.warn("Interrupt payload validation failed", {
      errors: result.error.issues,
    });
    return null;
  }
  return result.data;
}
```

### Commit message
```
fix(streaming): add logging for invalid interrupt data

- Log warning when interrupt data fails validation
- Include validation error details in log
- Preserve existing behavior (returns false) for backwards compat
- Aids debugging of interrupt handling issues
```

---

## Commit 5: Improve Error Detection to Use Structured Properties

**Severity**: MEDIUM
**Files to modify**:
- `src/utils/retry.ts` (already done in Commit 2)
- `src/data/data-source.interface.ts`

### Problem
Fragile string-based error detection. Different libraries structure errors differently.

### Implementation

1. Enhance `DataSourceError` in `src/data/data-source.interface.ts`:

```typescript
export class DataSourceError extends Error {
  readonly source: string;
  readonly isRetryable: boolean;
  readonly originalError?: Error;
  readonly statusCode?: number;
  readonly errorCode?: string;

  constructor(
    message: string,
    source: string,
    isRetryable: boolean,
    options?: {
      originalError?: Error;
      statusCode?: number;
      errorCode?: string;
    }
  ) {
    super(message);
    this.name = "DataSourceError";
    this.source = source;
    this.isRetryable = isRetryable;
    this.originalError = options?.originalError;
    this.statusCode = options?.statusCode;
    this.errorCode = options?.errorCode;
  }
}
```

2. Update Tavily source to populate structured properties:

```typescript
// In catch block:
throw new DataSourceError(
  error.message,
  "tavily",
  isRetryableError(error),
  {
    originalError: error instanceof Error ? error : undefined,
    statusCode: (error as any).status,
    errorCode: (error as any).code,
  }
);
```

### Commit message
```
feat(data): enhance DataSourceError with structured properties

- Add statusCode and errorCode to DataSourceError
- Populate structured properties from Tavily errors
- Enable reliable error detection without string matching
```

---

## Commit 6: Add Log Transport Abstraction

**Severity**: MEDIUM
**Files to modify**:
- `src/utils/logger.ts`

### Problem
Console-only logging limits production observability.

### Implementation

```typescript
export interface LogTransport {
  log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): void;
}

class ConsoleTransport implements LogTransport {
  log(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
    if (data && Object.keys(data).length > 0) {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

// Add to Logger class:
private transport: LogTransport;

constructor(context: string, correlationId: string | null = null, transport?: LogTransport) {
  this.transport = transport ?? new ConsoleTransport();
}

// Add factory for custom transport:
export function createLoggerWithTransport(
  context: string,
  correlationId: string | null,
  transport: LogTransport
): Logger {
  return new Logger(context, correlationId, transport);
}
```

### Commit message
```
feat(logger): add transport abstraction for flexible logging

- Define LogTransport interface
- Implement ConsoleTransport as default
- Add createLoggerWithTransport() factory
- Enable custom transports (file, cloud logging, etc.)
```

---

## Commit 7: Extract Token Limits to Constants

**Severity**: LOW
**Files to modify**:
- `src/utils/constants.ts`
- `src/agents/clarity.agent.ts`
- `src/agents/validator.agent.ts`
- `src/agents/synthesis.agent.ts`

### Problem
Token limits are hardcoded in multiple agents.

### Implementation

1. Add to `src/utils/constants.ts`:

```typescript
export const TOKEN_BUDGETS = {
  clarity: {
    conversationContext: 2000,
  },
  validator: {
    findings: 6000,
  },
  synthesis: {
    findings: 8000,
    conversationContext: 1500,
  },
} as const;
```

2. Update agents to use constants:

```typescript
// In validator.agent.ts:
import { TOKEN_BUDGETS } from "../utils/constants";

const maxFindingsTokens = TOKEN_BUDGETS.validator.findings;
```

### Commit message
```
refactor(agents): extract token limits to constants

- Define TOKEN_BUDGETS in constants.ts
- Update clarity, validator, synthesis agents
- Centralize token budget configuration
```

---

## Commit 8: Use Enums for Router Decisions

**Severity**: LOW
**Files to modify**:
- `src/graph/routers.ts`
- `src/types/routes.ts` (new)

### Problem
String-based router decisions lack type safety.

### Implementation

1. Create `src/types/routes.ts`:

```typescript
export const Routes = {
  CLARITY: "clarity",
  INTERRUPT: "interrupt",
  RESEARCH: "research",
  VALIDATOR: "validator",
  SYNTHESIS: "synthesis",
  ERROR_RECOVERY: "error-recovery",
} as const;

export type Route = (typeof Routes)[keyof typeof Routes];

// Specific router return types
export type ClarityRoute = typeof Routes.INTERRUPT | typeof Routes.RESEARCH | typeof Routes.ERROR_RECOVERY;
export type ResearchRoute = typeof Routes.VALIDATOR | typeof Routes.SYNTHESIS | typeof Routes.ERROR_RECOVERY;
export type ValidationRoute = typeof Routes.RESEARCH | typeof Routes.SYNTHESIS | typeof Routes.ERROR_RECOVERY;
```

2. Update routers to use typed constants:

```typescript
import { Routes, ClarityRoute } from "../types/routes";

export function clarityRouter(state: ResearchState): ClarityRoute {
  // ...
  return Routes.INTERRUPT;  // Instead of "interrupt"
}
```

### Commit message
```
refactor(graph): use typed route constants in routers

- Create Routes enum in types/routes.ts
- Define specific return types per router
- Update routers to use Routes constants
- Improve type safety for conditional edges
```

---

## Commit 9: Align Validator Fallback with LLM Criteria

**Severity**: LOW
**Files to modify**:
- `src/agents/validator.agent.ts`

### Problem
Rule-based fallback doesn't match LLM evaluation criteria.

### Implementation

```typescript
// Replace current fallback logic:
function ruleBasedValidation(findings: ResearchFindings): {
  result: "sufficient" | "insufficient";
  feedback: string;
} {
  const issues: string[] = [];

  // Match LLM criteria: recent news OR key developments required
  const hasContextualInfo = !!(findings.recentNews || findings.keyDevelopments);
  if (!hasContextualInfo) {
    issues.push("Missing both recent news and key developments");
  }

  // Stock info is optional but contributes to sufficiency
  const hasStockInfo = !!findings.stockInfo;

  // Sources quality check (matches LLM's source verification)
  const hasSources = findings.sources && findings.sources.length >= 2;
  if (!hasSources) {
    issues.push("Insufficient source verification (need at least 2 sources)");
  }

  // Sufficient if we have contextual info AND sources
  if (hasContextualInfo && hasSources) {
    return {
      result: "sufficient",
      feedback: hasStockInfo
        ? "Complete findings with stock data"
        : "Findings adequate, stock data unavailable",
    };
  }

  return {
    result: "insufficient",
    feedback: issues.join("; "),
  };
}
```

### Commit message
```
fix(validator): align fallback logic with LLM criteria

- Match rule-based validation with LLM evaluation criteria
- Require either recent news OR key developments (not all fields)
- Add source verification check (minimum 2 sources)
- Provide descriptive feedback for retry guidance
```

---

## Execution Order

```
git checkout -b fix/best-practices-remediation

# P1: Critical fixes
git commit  # Commit 1: Error wrapper
git commit  # Commit 2: p-retry implementation
git commit  # Commit 3: Cleanup old predicates

# P2: Important fixes
git commit  # Commit 4: Silent failure logging
git commit  # Commit 5: Structured error properties
git commit  # Commit 6: Log transport

# P3: Polish
git commit  # Commit 7: Token constants
git commit  # Commit 8: Route enums
git commit  # Commit 9: Validator fallback

git checkout main
git merge fix/best-practices-remediation
```

---

## Validation Checklist

After all commits:

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] Error recovery node can be triggered by actual exceptions
- [ ] Retry logic retries transient failures with backoff
- [ ] Logs include structured error details
- [ ] All token limits come from constants.ts
- [ ] Router decisions use typed constants
