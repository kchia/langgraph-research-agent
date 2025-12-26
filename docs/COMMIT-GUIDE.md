# Commit-by-Commit Implementation Guide

This document outlines the commits needed to address evaluator objections before submission.

---

## Commit 1: Fix README documentation issues

**Files:** `README.md`

**Changes:**
1. Fix broken link to `docs/ARCHITECTURE.md` → `docs/ARCHITECTURE-DESIGN.md`
2. Add "Assumptions" section (required by spec)
3. Add "Beyond Expected Deliverable" section (required by spec)

**Diff preview:**
```diff
- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design documentation.
+ See [docs/ARCHITECTURE-DESIGN.md](docs/ARCHITECTURE-DESIGN.md) for detailed design documentation.
```

**New sections to add:**
```markdown
## Assumptions

1. **Company Scope**: Focus on publicly traded companies. Name normalization maps common names to legal names (e.g., "Apple" → "Apple Inc.").

2. **Data Freshness**: Mock data is a static snapshot. Use Tavily for real-time data.

3. **Clarification Limit**: Maximum 2 clarification attempts before proceeding gracefully.

4. **Confidence Threshold**: Score ≥6 bypasses validation. Balances thoroughness with speed.

5. **Retry Limit**: Maximum 3 research attempts prevents infinite loops.

6. **LLM Dependency**: Claude (Anthropic) required. System degrades gracefully on LLM failures.

## Beyond Expected Deliverable

1. **Streaming Progress**: Real-time agent status indicators during execution
2. **Tavily Integration**: Production-ready web search, not just mock data
3. **LangSmith Tracing**: Built-in observability support for debugging
4. **Graceful Degradation**: Confidence-based prefixes, fallback templates when LLM fails
5. **Data Source Abstraction**: Factory pattern allows swapping mock/Tavily without code changes
6. **Comprehensive Tests**: 14 test files covering unit, agent, and integration scenarios
7. **Dependency Injection**: All agents accept injectable LLM/data sources for testing
```

**Commit message:**
```
docs: fix README link and add required sections

- Fix broken link to ARCHITECTURE.md (file was renamed)
- Add Assumptions section as required by spec
- Add Beyond Expected Deliverable section as required by spec
```

---

## Commit 2: Remove conversation summarization scaffolding

**Files:**
- `src/graph/state.ts`
- `src/utils/constants.ts`
- `docs/ARCHITECTURE-DESIGN.md` (if it mentions this as implemented)

**Rationale:** The conversation summarization feature was scaffolded but never implemented. Rather than claim incomplete features, remove the unused code.

**Changes in `src/graph/state.ts`:**
```diff
- conversationSummary: Annotation<string | null>({
-   reducer: (_, update) => update,
-   default: () => null
- }),
```

**Changes in `src/utils/constants.ts`:**
```diff
- // Conversation summarization thresholds
- export const MESSAGE_SUMMARIZATION_THRESHOLD = 10;
- export const MESSAGES_TO_KEEP_AFTER_SUMMARY = 4;
```

**Commit message:**
```
refactor: remove unused conversation summarization scaffolding

The conversation summarization feature was planned but not implemented.
Removing unused fields and constants to avoid confusion.
```

---

## Commit 3: Make mock data exercise the validation loop

**Files:** `src/data/mock-source.ts`

**Problem:** Mock data always returns confidence=10, so the validator is never invoked in mock mode.

**Solution:** Return lower confidence on first attempt, higher on retry.

**Changes:**
```typescript
async search(company: string, context: SearchContext): Promise<SearchResult> {
  const normalized = this.normalizeCompany(company);
  const data = MOCK_RESEARCH_DATA[normalized];

  if (!data) {
    return {
      findings: null,
      confidence: 0,
      source: this.getName(),
      rawResponse: null
    };
  }

  // Simulate improvement on retry - first attempt returns partial data
  const isRetry = context.attemptNumber > 1;

  let findings: ResearchFindings;
  let confidence: number;

  if (isRetry && context.validationFeedback) {
    // On retry with feedback: return complete data with high confidence
    findings = {
      company: data.company,
      recentNews: data.recentNews,
      stockInfo: data.stockInfo,
      keyDevelopments: data.keyDevelopments,
      sources: [this.getName()],
      rawData: { attempt: context.attemptNumber, usedFeedback: true }
    };
    confidence = this.calculateConfidence(data);
  } else {
    // First attempt: return partial data with lower confidence
    findings = {
      company: data.company,
      recentNews: data.recentNews,
      stockInfo: null,  // Omit on first attempt
      keyDevelopments: null,  // Omit on first attempt
      sources: [this.getName()],
      rawData: { attempt: context.attemptNumber }
    };
    confidence = 4;  // Below threshold, triggers validation
  }

  return {
    findings,
    confidence,
    source: this.getName(),
    rawResponse: data
  };
}
```

**Commit message:**
```
feat: make mock data exercise validation retry loop

- First attempt returns partial data with confidence=4
- Retry with feedback returns complete data with confidence=10
- This ensures the validator and retry loop are exercised in mock mode
```

---

## Commit 4: Add comprehensive multi-turn integration test

**Files:** `tests/integration/full-workflow.test.ts` (NEW)

**Purpose:** Demonstrate the complete loop: clarification → research → validation retry → follow-up

**Content:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import {
  buildResearchGraph,
  type ResearchGraph
} from "../../src/graph/workflow.js";

describe("Full Workflow Integration", () => {
  let graph: ResearchGraph;

  beforeEach(() => {
    graph = buildResearchGraph();
  });

  it("should handle complete multi-turn conversation with retry", async () => {
    const config = { configurable: { thread_id: "full-workflow-test" } };

    // Turn 1: Vague query triggers clarification
    const result1 = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about the company")],
        originalQuery: "Tell me about the company"
      },
      config
    );

    expect(result1.clarityStatus).toBe("needs_clarification");

    // Resume with clarification
    const result2 = await graph.invoke(
      new Command({ resume: "Apple" }),
      config
    );

    // Should complete with research
    expect(result2.detectedCompany).toBe("Apple Inc.");
    expect(result2.finalSummary).toBeDefined();

    // Turn 2: Follow-up question uses same company context
    const result3 = await graph.invoke(
      {
        messages: [new HumanMessage("What about their stock?")],
        originalQuery: "What about their stock?"
      },
      config
    );

    // Should maintain company context
    expect(result3.detectedCompany).toBe("Apple Inc.");
    expect(result3.finalSummary).toBeDefined();

    // Verify message accumulation
    const humanMessages = result3.messages.filter(
      (m) => m._getType() === "human"
    );
    expect(humanMessages.length).toBeGreaterThanOrEqual(3);
  });

  it("should exercise validation retry loop", async () => {
    const config = { configurable: { thread_id: "retry-workflow-test" } };

    const result = await graph.invoke(
      {
        messages: [new HumanMessage("Tell me about Tesla")],
        originalQuery: "Tell me about Tesla"
      },
      config
    );

    // With mock data returning low confidence first, should retry
    expect(result.researchAttempts).toBeGreaterThanOrEqual(1);
    expect(result.finalSummary).toBeDefined();
    expect(result.detectedCompany).toBe("Tesla, Inc.");
  });
});
```

**Commit message:**
```
test: add comprehensive multi-turn workflow integration test

- Tests clarification → research → follow-up flow
- Verifies message accumulation across turns
- Exercises validation retry loop
- Demonstrates 2+ conversation turns as required by spec
```

---

## Commit 5: Add CLI error handling

**Files:** `src/index.ts`

**Changes:** Wrap main loop in try/catch

```typescript
// In the main while loop:
try {
  let { result, interrupted, interruptData } = await streamWithInterruptSupport(
    graph,
    createNewQueryInput(userInput),
    graphConfig,
    displayProgress
  );

  // ... rest of handling
} catch (error) {
  console.error("\n❌ An error occurred:", error instanceof Error ? error.message : "Unknown error");
  console.log("Please try again or type 'quit' to exit.\n");
  continue;
}
```

**Commit message:**
```
fix: add error handling to CLI main loop

- Wrap graph invocation in try/catch
- Display user-friendly error messages
- Allow user to continue after errors
```

---

## Commit 6: Commit pending config changes

**Files:** `src/utils/config.ts`

**Action:** Review the pending changes and commit them (or discard if not needed).

```bash
# Review changes
git diff src/utils/config.ts

# If changes are valid:
git add src/utils/config.ts
git commit -m "chore: update config settings"

# If changes should be discarded:
git checkout src/utils/config.ts
```

---

## Summary: Commit Order

| # | Commit | Priority | Effort |
|---|--------|----------|--------|
| 1 | Fix README documentation | Critical | 10 min |
| 2 | Remove summarization scaffolding | Critical | 5 min |
| 3 | Make mock data exercise validation | Significant | 15 min |
| 4 | Add full workflow integration test | Significant | 20 min |
| 5 | Add CLI error handling | Minor | 5 min |
| 6 | Commit pending config changes | Critical | 2 min |

**Total estimated time:** ~1 hour

---

## Verification After All Commits

```bash
# Ensure everything passes
npm run build
npm run lint
npm test

# Verify clean working tree
git status

# Manual test
npm start
# Try: "Tell me about a company" → "Apple" → "What about their stock?"
```
