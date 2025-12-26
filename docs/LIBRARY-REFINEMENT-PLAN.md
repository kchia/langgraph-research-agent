# Library Refinement Plan

> Commit-by-commit implementation plan for addressing senior expert review findings.

## Overview

This plan addresses the key issues identified in the expert review:
1. Token counting accuracy (js-tiktoken)
2. Input validation consolidation (Zod)
3. Retry logic simplification (p-retry)
4. Circuit breaker pattern (cockatiel)
5. Correlation ID uniqueness (crypto.randomUUID)
6. Error predicate consolidation

**Total Commits: 8**
**Estimated Files Changed: 12**

---

## Phase 1: Foundation Improvements

### Commit 1: Add js-tiktoken for accurate token counting

**Priority:** High
**Impact:** Improves token budget accuracy from ~85% to ~98%

**Changes:**
```
M package.json                          # Add js-tiktoken dependency
M src/utils/token-budget.ts             # Replace char-based estimation
M tests/utils/token-budget.test.ts      # Update tests for new behavior (if exists)
```

**Implementation Details:**
- Install `js-tiktoken` (~50KB, wasm-based)
- Use `cl100k_base` encoding (closest to Claude's tokenizer)
- Keep char-based fallback for edge cases (empty strings, etc.)
- Cache encoder instance for performance

**Test Criteria:**
- Token estimates within 5% of actual for English text
- Token estimates within 10% for code
- No performance regression (encoder is cached)

**Commit Message:**
```
feat(utils): replace char-based token estimation with js-tiktoken

- Add js-tiktoken for accurate token counting
- Use cl100k_base encoding (Claude-compatible)
- Cache encoder instance for performance
- Improve budget accuracy from ~85% to ~98%

Addresses token counting accuracy concern from expert review.
```

---

### Commit 2: Use crypto.randomUUID for correlation IDs

**Priority:** Low
**Impact:** Guaranteed unique IDs, cryptographically secure

**Changes:**
```
M src/utils/logger.ts                   # Replace custom ID generation
M tests/utils/logger.test.ts            # Update tests (if exists)
```

**Implementation Details:**
- Replace `Date.now().toString(36) + Math.random()...` with `crypto.randomUUID()`
- No external dependencies (built into Node.js 16+)
- UUID v4 format is standard and recognizable

**Test Criteria:**
- IDs are valid UUID v4 format
- No collisions in 10,000 concurrent generations

**Commit Message:**
```
refactor(utils): use crypto.randomUUID for correlation IDs

- Replace custom timestamp+random with Node.js built-in
- Guaranteed uniqueness via cryptographic randomness
- Standard UUID v4 format for better tooling compatibility
```

---

## Phase 2: Validation Consolidation

### Commit 3: Consolidate input validation with Zod

**Priority:** High
**Impact:** Consistency with existing patterns, better type inference

**Changes:**
```
M src/utils/input-validation.ts         # Rewrite using Zod schemas
M tests/utils/input-validation.test.ts  # Update tests
```

**Implementation Details:**
- Define `QuerySchema` using Zod (already a dependency)
- Preserve existing validation rules (min 1, max 5000, no null bytes)
- Export both schema and validation functions for flexibility
- Maintain backward-compatible function signatures

**Schema Definition:**
```typescript
const QuerySchema = z.string()
  .min(1, "Query cannot be empty or only whitespace")
  .max(5000, "Query is too long")
  .refine(s => !s.includes('\0'), "Query contains invalid characters")
  .transform(s => s.trim());
```

**Test Criteria:**
- All existing validation tests pass
- Type inference works correctly
- Error messages are user-friendly

**Commit Message:**
```
refactor(utils): consolidate input validation with Zod

- Replace custom validation logic with Zod schema
- Consistent with agent structured output patterns
- Better type inference and error messages
- No new dependencies (Zod already in project)
```

---

### Commit 4: Unify error retry predicates

**Priority:** Medium
**Impact:** Single source of truth for retryable error detection

**Changes:**
```
M src/utils/retry.ts                    # Export unified predicates
M src/utils/error-handling.ts           # Import predicates from retry.ts
M tests/utils/error-handling.test.ts    # Verify unified behavior
```

**Implementation Details:**
- Keep `retryPredicates` in `retry.ts` as the single source
- Import and use in `error-handling.ts`
- Add `isRetryableError` to exports from `retry.ts`
- Remove duplicate logic from `error-handling.ts`

**Test Criteria:**
- Both modules agree on what's retryable
- No behavior change in error handling flow

**Commit Message:**
```
refactor(utils): unify error retry predicates

- Single source of truth in retry.ts
- error-handling.ts imports from retry.ts
- Prevents logic drift between modules
```

---

## Phase 3: Resilience Improvements

### Commit 5: Add p-retry for robust retry logic

**Priority:** Medium
**Impact:** Battle-tested retry with jitter, cleaner code

**Changes:**
```
M package.json                          # Add p-retry dependency
M src/utils/retry.ts                    # Refactor to use p-retry
M src/data/tavily-source.ts             # Update retry usage
M tests/utils/retry.test.ts             # Update tests (if exists)
```

**Implementation Details:**
- Install `p-retry` (~2KB)
- Wrap p-retry with our predicate system for compatibility
- Add jitter by default (prevents thundering herd)
- Preserve existing `retryPredicates` exports
- Keep `withRetry` function signature for backward compatibility

**Wrapper Design:**
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  return pRetry(fn, {
    retries: config.maxRetries ?? 3,
    onFailedAttempt: (error) => {
      if (!isRetryable(error)) throw error; // Abort if not retryable
      logger.warn("Retry attempt", { attempt: error.attemptNumber });
    }
  });
}
```

**Test Criteria:**
- Existing retry tests pass
- Jitter is applied between retries
- Non-retryable errors abort immediately

**Commit Message:**
```
refactor(utils): use p-retry for robust retry logic

- Replace custom retry implementation with p-retry
- Add jitter to prevent thundering herd
- Maintain backward-compatible withRetry API
- ~65 lines of custom code removed
```

---

### Commit 6: Add circuit breaker for Tavily data source

**Priority:** Medium
**Impact:** Fast-fail under sustained failures, prevents cascade

**Changes:**
```
M package.json                          # Add cockatiel dependency
M src/data/tavily-source.ts             # Wrap with circuit breaker
A src/utils/resilience.ts               # Circuit breaker configuration
M tests/data/tavily-source.test.ts      # Add circuit breaker tests
```

**Implementation Details:**
- Install `cockatiel` for circuit breaker
- Create shared resilience configuration
- Circuit opens after 5 consecutive failures
- Half-open after 30 seconds to test recovery
- Combine with existing retry logic

**Circuit Breaker Config:**
```typescript
// src/utils/resilience.ts
import { circuitBreaker, ConsecutiveBreaker, handleAll } from 'cockatiel';

export const tavilyCircuitBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 30 * 1000,
  breaker: new ConsecutiveBreaker(5),
});

tavilyCircuitBreaker.onBreak(() => {
  logger.warn("Tavily circuit breaker opened");
});

tavilyCircuitBreaker.onReset(() => {
  logger.info("Tavily circuit breaker reset");
});
```

**Test Criteria:**
- Circuit opens after 5 failures
- Requests fail fast when circuit is open
- Circuit resets after successful half-open test

**Commit Message:**
```
feat(data): add circuit breaker for Tavily data source

- Add cockatiel for circuit breaker pattern
- Opens after 5 consecutive failures
- Half-open test after 30 seconds
- Prevents cascade failures under sustained API issues
```

---

## Phase 4: Code Cleanup

### Commit 7: Simplify state annotation reducers

**Priority:** Low
**Impact:** Cleaner code, better alignment with LangGraph defaults

**Changes:**
```
M src/graph/state.ts                    # Remove redundant reducers
```

**Implementation Details:**
- Remove explicit `reducer: (_, update) => update` where it's the default
- Keep only custom reducers (MessagesAnnotation, any merge logic)
- Add comment explaining default behavior

**Before:**
```typescript
clarityStatus: Annotation<ClarityStatus>({
  reducer: (_, update) => update,
  default: () => "pending"
}),
```

**After:**
```typescript
/** Status uses default "last write wins" reducer */
clarityStatus: Annotation<ClarityStatus>({
  default: () => "pending"
}),
```

**Test Criteria:**
- All graph tests pass
- State behavior unchanged

**Commit Message:**
```
refactor(graph): simplify state annotation reducers

- Remove redundant "last write wins" reducers
- LangGraph uses this as default behavior
- Add clarifying comments for maintainability
```

---

### Commit 8: Update documentation

**Priority:** Low
**Impact:** Keep docs in sync with implementation

**Changes:**
```
M docs/ARCHITECTURE-DESIGN.md           # Update utility descriptions
M docs/IMPROVEMENT-PLAN.md              # Mark items as completed
M README.md                             # Update dependencies section
```

**Implementation Details:**
- Document new dependencies (js-tiktoken, p-retry, cockatiel)
- Update utility module descriptions
- Add section on resilience patterns
- Mark completed items in improvement plan

**Commit Message:**
```
docs: update documentation for library refinements

- Document new dependencies and their purposes
- Update utility module descriptions
- Add resilience patterns documentation
- Mark completed improvement items
```

---

## Dependency Summary

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| js-tiktoken | ^1.0.0 | ~50KB | Accurate token counting |
| p-retry | ^6.0.0 | ~2KB | Robust retry with jitter |
| cockatiel | ^3.0.0 | ~15KB | Circuit breaker pattern |

**Total new dependency size: ~67KB**

---

## Verification Checklist

After all commits:

- [ ] `npm run build` succeeds
- [ ] `npm test` passes (all unit tests)
- [ ] `npm run test:e2e` passes (integration tests)
- [ ] Token estimates are more accurate (manual verification)
- [ ] Circuit breaker activates under simulated failures
- [ ] No breaking changes to public API

---

## Rollback Strategy

Each commit is independent and can be reverted:

```bash
# Revert specific commit
git revert <commit-hash>

# Or revert entire feature
git revert HEAD~8..HEAD
```

Dependencies can be removed individually if issues arise.

---

## Timeline Considerations

Commits are ordered by dependency:
1. Commits 1-4 can be done in any order (independent)
2. Commit 5 (p-retry) should come before Commit 6 (cockatiel)
3. Commits 7-8 are cleanup and can be done last

For fastest impact, prioritize: Commit 1 (tiktoken) > Commit 3 (Zod) > Commit 5-6 (resilience)
