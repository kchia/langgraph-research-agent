# Research Assistant: Comprehensive Architecture Document

> **Version**: 1.2.0  
> **Status**: Final Design — Reviewed and Ready for Implementation  
> **Last Updated**: December 2024  
> **Review Status**: ✅ Verified for accuracy, consistency, and LangGraph best practices

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture Decisions](#3-architecture-decisions)
4. [State Design](#4-state-design)
5. [Agent Specifications](#5-agent-specifications)
6. [Routing Logic](#6-routing-logic)
7. [Graph Structure](#7-graph-structure)
8. [Human-in-the-Loop Design](#8-human-in-the-loop-design)
9. [Multi-Turn Conversation Handling](#9-multi-turn-conversation-handling)
10. [Beyond Expected Features](#10-beyond-expected-features)
11. [Error Handling & Edge Cases](#11-error-handling--edge-cases)
12. [Project Structure](#12-project-structure)
13. [Test Scenarios](#13-test-scenarios)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Appendices](#15-appendices)

---

## 1. Executive Summary

### 1.1 Problem Statement

Build a multi-agent research assistant using LangGraph that helps users gather information about companies. The system must support:

- Multiple specialized agents working together
- Follow-up questions with conversation memory
- Human clarification requests when queries are ambiguous

### 1.2 Solution Overview

A 4-agent orchestrated workflow using LangGraph's Graph API:

```
User Query → Clarity Agent → Research Agent → Validator Agent → Synthesis Agent → Response
                  ↓                ↑               │
              [Interrupt]          └───────────────┘
              (if unclear)         (retry loop if insufficient)
```

### 1.3 Key Design Decisions

| Decision           | Choice                     | Rationale                                                                  |
| ------------------ | -------------------------- | -------------------------------------------------------------------------- |
| API                | Graph API                  | Explicit state schema, visual debugging, conditional edges are first-class |
| Interrupt Strategy | Loop back to Clarity       | Handles edge cases (still-vague clarifications, topic changes)             |
| LLM Strategy       | Real LLM + Pluggable Data  | Tests real agent behavior, supports mock and Tavily                        |
| Data Source        | Mock + Tavily (switchable) | Mock for dev/test, Tavily for production — same interface                  |

### 1.4 Deliverables Checklist

| #   | Requirement                                             | Status                |
| --- | ------------------------------------------------------- | --------------------- |
| 1   | Working LangGraph with 4 agents                         | ✅ Designed           |
| 2   | State schema with all required fields                   | ✅ Designed           |
| 3   | 3 conditional routing functions                         | ✅ Designed (4 total) |
| 4   | Feedback loop Validator → Research with attempt counter | ✅ Designed           |
| 5   | Interrupt mechanism for unclear queries                 | ✅ Designed           |
| 6   | Multi-turn conversation handling with memory            | ✅ Designed           |
| 7   | 2+ example conversation turns                           | ✅ Planned            |
| 8   | Software engineering best practices                     | ✅ Planned            |
| 9   | README with run instructions                            | ✅ Planned            |
| 10  | Assumptions documented                                  | ✅ Planned            |
| 11  | Beyond Expected Deliverable                             | ✅ Designed           |

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              RESEARCH ASSISTANT SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────────────┐    │
│  │   CLIENT    │     │                    LANGGRAPH WORKFLOW                    │    │
│  │  INTERFACE  │     │  ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌───────┐ │    │
│  │             │◄───►│  │ CLARITY │──►│ RESEARCH │──►│ VALIDATOR │──►│SYNTH- │ │    │
│  │ • Console   │     │  │  AGENT  │   │  AGENT   │   │   AGENT   │   │ ESIS  │ │    │
│  │ • Streaming │     │  └────┬────┘   └────┬─────┘   └─────┬─────┘   └───────┘ │    │
│  │             │     │       │             ▲               │                    │    │
│  └─────────────┘     │       ▼             │               │                    │    │
│                      │  ┌─────────┐        └───────────────┘                    │    │
│                      │  │INTERRUPT│        (retry loop)                         │    │
│                      │  │  NODE   │                                             │    │
│                      │  └─────────┘                                             │    │
│                      └─────────────────────────────────────────────────────────┘    │
│                                              │                                       │
│                      ┌───────────────────────┴───────────────────────┐              │
│                      │                                               │              │
│                      ▼                                               ▼              │
│              ┌──────────────┐                               ┌──────────────┐        │
│              │ CHECKPOINTER │                               │   LLM API    │        │
│              │ (MemorySaver │                               │  (Anthropic/ │        │
│              │  / Postgres) │                               │   OpenAI)    │        │
│              └──────────────┘                               └──────────────┘        │
│                                                                                      │
│              ┌──────────────┐                               ┌──────────────┐        │
│              │  LANGSMITH   │                               │  MOCK DATA   │        │
│              │  (Tracing)   │                               │  (Research)  │        │
│              └──────────────┘                               └──────────────┘        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent Responsibilities

| Agent               | Input                               | Processing                                  | Output                                   |
| ------------------- | ----------------------------------- | ------------------------------------------- | ---------------------------------------- |
| **Clarity Agent**   | User query + conversation history   | Analyze query clarity, extract company name | `clarityStatus`, `detectedCompany`       |
| **Research Agent**  | Company name + research context     | Fetch company data (mock/Tavily)            | `researchFindings`, `confidenceScore`    |
| **Validator Agent** | Research findings + original query  | Assess completeness and relevance           | `validationResult`, `validationFeedback` |
| **Synthesis Agent** | All findings + conversation history | Generate user-friendly summary              | `finalSummary`                           |

### 2.3 Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW DIAGRAM                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  USER INPUT                                                                   │
│      │                                                                        │
│      ▼                                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ messages: BaseMessage[]  ──► Appended to conversation history          │   │
│  │ originalQuery: string    ──► Extracted from latest human message       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│      │                                                                        │
│      ▼                                                                        │
│  ┌─────────────────┐                                                          │
│  │  CLARITY AGENT  │                                                          │
│  │                 │──► clarityStatus: "clear" | "needs_clarification"        │
│  │  LLM Analysis   │──► detectedCompany: "Apple Inc." | null                  │
│  │                 │──► clarificationQuestion: "Which company?" | null        │
│  └─────────────────┘                                                          │
│      │                                                                        │
│      ├─── if needs_clarification ───► INTERRUPT (await user input)            │
│      │                                     │                                  │
│      │                                     ▼                                  │
│      │                               User provides clarification              │
│      │                                     │                                  │
│      │◄────────────────────────────────────┘                                  │
│      │                                                                        │
│      ▼                                                                        │
│  ┌─────────────────┐                                                          │
│  │ RESEARCH AGENT  │                                                          │
│  │                 │──► researchFindings: { company, news, stock, ... }       │
│  │  Data Fetching  │──► confidenceScore: 0-10                                 │
│  │                 │──► researchAttempts: incremented                         │
│  └─────────────────┘                                                          │
│      │                                                                        │
│      ├─── if confidence >= 6 ───► SYNTHESIS (skip validation)                 │
│      │                                                                        │
│      ▼                                                                        │
│  ┌─────────────────┐                                                          │
│  │VALIDATOR AGENT  │                                                          │
│  │                 │──► validationResult: "sufficient" | "insufficient"       │
│  │ Quality Check   │──► validationFeedback: "Missing financial data..."       │
│  └─────────────────┘                                                          │
│      │                                                                        │
│      ├─── if insufficient AND attempts < 3 ───► RESEARCH (loop back)          │
│      │                                                                        │
│      ▼                                                                        │
│  ┌─────────────────┐                                                          │
│  │SYNTHESIS AGENT  │                                                          │
│  │                 │──► finalSummary: "Here's what I found about Apple..."    │
│  │ Response Gen    │──► messages: [..., AIMessage(summary)]                   │
│  └─────────────────┘                                                          │
│      │                                                                        │
│      ▼                                                                        │
│  USER OUTPUT (streamed)                                                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Decisions

### 3.1 Graph API vs Functional API

**Decision**: Graph API

| Factor              | Graph API                      | Functional API        | Verdict                                                  |
| ------------------- | ------------------------------ | --------------------- | -------------------------------------------------------- |
| State Schema        | Explicit `Annotation.Root`     | Function-scoped       | **Graph** — requirement explicitly asks for state schema |
| Conditional Routing | `addConditionalEdges`          | `if/else` in code     | **Graph** — requirement asks for "routing functions"     |
| Visualization       | Auto-generated Mermaid         | None                  | **Graph** — crucial for debugging 4-agent flow           |
| Feedback Loops      | Explicit edges, visible        | Hidden in code        | **Graph** — Validator→Research loop must be auditable    |
| Checkpointing       | Per-superstep                  | Per-entrypoint        | **Graph** — finer-grained recovery                       |
| Team Understanding  | Visual = instant comprehension | Requires code reading | **Graph** — deliverable is evaluated by humans           |

**Rationale**: The requirements explicitly ask for state schema definition, conditional routing functions, and feedback loops — all first-class concepts in Graph API.

### 3.2 Interrupt Strategy

**Decision**: Loop back to Clarity Agent after interrupt resume

**Options Considered**:

| Option            | Description                           | Pros                                                              | Cons                  |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| A. Loop Back      | After resume, re-run Clarity Agent    | Handles still-vague clarifications, topic changes, graceful exits | Slightly more complex |
| B. Direct Proceed | After resume, go directly to Research | Simpler, faster happy path                                        | Fails on edge cases   |

**Critical Edge Cases Only Option A Handles**:

1. **Still-vague clarification**: "The tech one" → needs re-clarification
2. **Topic change**: "Actually, tell me about AI instead" → needs re-routing
3. **Graceful exit**: "Nevermind" → needs detection, not research
4. **Company name extraction**: "The electric car company" → needs LLM to extract "Tesla"

**Loop Protection**: Maximum 2 clarification attempts before graceful degradation.

### 3.3 LLM Strategy

**Decision**: Real LLM calls with mocked research data

| Approach             | Pros                                       | Cons                           |
| -------------------- | ------------------------------------------ | ------------------------------ |
| Mock Everything      | Fast, deterministic tests                  | Doesn't test real LLM behavior |
| Real LLM + Mock Data | Tests real agent logic, deterministic data | Slower, costs tokens           |
| Real Everything      | Full integration                           | Unpredictable, expensive       |

**Rationale**: Real LLM calls test the actual prompts and parsing logic. Mock research data ensures reproducible test scenarios and doesn't require API keys for Tavily.

### 3.4 Data Source Architecture

**Decision**: Strategy pattern with runtime-switchable data sources (Mock + Tavily)

Both data sources are first-class implementations, not one being a fallback for the other.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                      ┌───────────────────────────┐                          │
│                      │   ResearchDataSource      │                          │
│                      │      <<interface>>        │                          │
│                      ├───────────────────────────┤                          │
│                      │ + search(query, company)  │                          │
│                      │ + getName(): string       │                          │
│                      │ + isAvailable(): boolean  │                          │
│                      └─────────────┬─────────────┘                          │
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    │                               │                        │
│           ┌────────▼────────┐            ┌────────▼────────┐                │
│           │ MockDataSource  │            │ TavilyDataSource│                │
│           ├─────────────────┤            ├─────────────────┤                │
│           │ • Fast          │            │ • Real-time     │                │
│           │ • Deterministic │            │ • Comprehensive │                │
│           │ • No API key    │            │ • Requires key  │                │
│           │ • Limited data  │            │ • Rate limited  │                │
│           └─────────────────┘            └─────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Configuration**:

```typescript
// Environment-based selection
const DATA_SOURCE = process.env.RESEARCH_DATA_SOURCE ?? "mock"; // "mock" | "tavily"

// Or explicit in code
const dataSource =
  DATA_SOURCE === "tavily" ? new TavilyDataSource() : new MockDataSource();

const researchAgent = createResearchAgent(dataSource);
```

**Why Both?**

| Use Case              | Recommended Source                         |
| --------------------- | ------------------------------------------ |
| Development & testing | Mock — fast, no API costs                  |
| CI/CD pipeline        | Mock — deterministic assertions            |
| Demo/presentation     | Mock — predictable behavior                |
| Production            | Tavily — real-time data                    |
| Evaluator testing     | Both — show mock works, Tavily is "beyond" |

---

## 4. State Design

### 4.1 State Schema Overview

The state schema is the **contract** for the entire workflow. Every agent reads from and writes to this shared state.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STATE SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ CONVERSATION                                                         │    │
│  │ • messages: BaseMessage[]           (append reducer)                 │    │
│  │ • conversationSummary: string|null  (for long conversations)         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ QUERY ANALYSIS                                                       │    │
│  │ • originalQuery: string             (latest user query)              │    │
│  │ • clarityStatus: ClarityStatus      ("pending"|"clear"|"needs_...")  │    │
│  │ • clarificationAttempts: number     (loop protection)                │    │
│  │ • clarificationQuestion: string|null                                 │    │
│  │ • detectedCompany: string|null      (extracted company name)         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ RESEARCH                                                             │    │
│  │ • researchFindings: ResearchFindings|null                            │    │
│  │ • confidenceScore: number           (0-10)                           │    │
│  │ • researchAttempts: number          (loop protection)                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ VALIDATION                                                           │    │
│  │ • validationResult: ValidationResult ("pending"|"sufficient"|...)    │    │
│  │ • validationFeedback: string|null   (guidance for retry)             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ OUTPUT                                                               │    │
│  │ • finalSummary: string|null         (user-facing response)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ METADATA                                                             │    │
│  │ • currentAgent: AgentName           (for observability)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Complete State Definition (TypeScript)

```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clarity analysis result from the Clarity Agent
 */
export type ClarityStatus = "pending" | "clear" | "needs_clarification";

/**
 * Validation result from the Validator Agent
 */
export type ValidationResult = "pending" | "sufficient" | "insufficient";

/**
 * Agent identifiers for observability and routing
 */
export type AgentName =
  | "clarity"
  | "research"
  | "validator"
  | "synthesis"
  | "interrupt";

/**
 * Structured research findings from data sources
 */
export interface ResearchFindings {
  /** Normalized company name */
  company: string;

  /** Recent news summary */
  recentNews: string | null;

  /** Stock/financial information */
  stockInfo: string | null;

  /** Key business developments */
  keyDevelopments: string | null;

  /** Data source citations */
  sources: string[];

  /** Raw data for debugging */
  rawData: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE ANNOTATION
// ═══════════════════════════════════════════════════════════════════════════

export const ResearchStateAnnotation = Annotation.Root({
  // ─────────────────────────────────────────────────────────────────────────
  // CONVERSATION HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Full conversation history for multi-turn support.
   * Uses append reducer to accumulate messages across turns.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),

  /**
   * Condensed summary of older messages for long conversations.
   * Used when message count exceeds threshold (Beyond Feature).
   */
  conversationSummary: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * The user's original query text, extracted from the latest HumanMessage.
   * Preserved separately for clarity analysis even as messages grow.
   */
  originalQuery: Annotation<string>({
    reducer: (_, update) => update,
    default: () => ""
  }),

  /**
   * Result of the Clarity Agent's analysis.
   * - "pending": Not yet analyzed
   * - "clear": Query is actionable, company identified
   * - "needs_clarification": Query is ambiguous, interrupt required
   */
  clarityStatus: Annotation<ClarityStatus>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  /**
   * Number of clarification attempts in current query flow.
   * Used for loop protection (max 2 attempts).
   */
  clarificationAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Question to ask user when clarification is needed.
   * Set by Clarity Agent, consumed by Interrupt node.
   */
  clarificationQuestion: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Extracted/normalized company name from user query.
   * Persisted across turns for follow-up question context.
   */
  detectedCompany: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // RESEARCH RESULTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Structured research data from mock/Tavily source.
   * Null if research hasn't run or found no data.
   */
  researchFindings: Annotation<ResearchFindings | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  /**
   * Research Agent's confidence in findings (0-10 scale).
   * - 0-5: Low confidence, requires validation
   * - 6-8: Medium confidence, can proceed to synthesis
   * - 9-10: High confidence
   */
  confidenceScore: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  /**
   * Number of research attempts in current query flow.
   * Incremented by Research Agent, checked by Validator routing.
   * Max 3 attempts before forced synthesis.
   */
  researchAttempts: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validator Agent's assessment of research quality.
   * - "pending": Not yet validated
   * - "sufficient": Research adequately answers query
   * - "insufficient": Research needs improvement
   */
  validationResult: Annotation<ValidationResult>({
    reducer: (_, update) => update,
    default: () => "pending"
  }),

  /**
   * Validator's feedback for improving research.
   * Used by Research Agent on retry to focus search.
   */
  validationFeedback: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // OUTPUT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Final user-facing summary from Synthesis Agent.
   * This is what gets returned to the user.
   */
  finalSummary: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null
  }),

  // ─────────────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Currently executing agent for observability/streaming.
   * Updated at the start of each agent.
   */
  currentAgent: Annotation<AgentName>({
    reducer: (_, update) => update,
    default: () => "clarity"
  })
});

// Export the inferred state type for use in agents
export type ResearchState = typeof ResearchStateAnnotation.State;
```

### 4.3 State Field Responsibilities

| Field                   | Written By  | Read By              | Reducer | Why This Reducer                         |
| ----------------------- | ----------- | -------------------- | ------- | ---------------------------------------- |
| `messages`              | All agents  | All agents           | Append  | Multi-turn requires history preservation |
| `conversationSummary`   | Summarizer  | Clarity, Synthesis   | Replace | Only latest summary matters              |
| `originalQuery`         | Entry point | Clarity, Validator   | Replace | Need current query, not history          |
| `clarityStatus`         | Clarity     | Router               | Replace | Binary decision per query                |
| `clarificationAttempts` | Interrupt   | Clarity, Router      | Replace | Counter, not accumulator                 |
| `clarificationQuestion` | Clarity     | Interrupt            | Replace | One question at a time                   |
| `detectedCompany`       | Clarity     | Research, Follow-up  | Replace | Current company context                  |
| `researchFindings`      | Research    | Validator, Synthesis | Replace | Latest findings only                     |
| `confidenceScore`       | Research    | Router               | Replace | Score for current attempt                |
| `researchAttempts`      | Research    | Router               | Replace | Counter for loop protection              |
| `validationResult`      | Validator   | Router               | Replace | Decision for current findings            |
| `validationFeedback`    | Validator   | Research             | Replace | Guidance for current retry               |
| `finalSummary`          | Synthesis   | Client               | Replace | Final output                             |
| `currentAgent`          | All agents  | Observability        | Replace | Current position in graph                |

### 4.4 State Reset Between Queries

When a new query comes in (same thread), certain fields should reset:

```typescript
// Fields that reset on new query
const querySpecificFields = {
  originalQuery: newQuery,
  clarityStatus: "pending",
  clarificationAttempts: 0,
  clarificationQuestion: null,
  researchFindings: null,
  confidenceScore: 0,
  researchAttempts: 0,
  validationResult: "pending",
  validationFeedback: null,
  finalSummary: null,
};

// Fields that persist across queries (same thread)
const persistentFields = {
  messages: [...], // Accumulates
  conversationSummary: "...", // Persists
  detectedCompany: "Apple Inc.", // Persists for follow-ups
};
```

#### Implementation Strategy

There are three approaches to handle state reset. **We recommend Option A** for this project:

**Option A: Reset in Input (Recommended)**
Include reset values when invoking with a new query:

```typescript
// In the conversation loop
async function handleNewQuery(query: string, threadId: string) {
  const config = { configurable: { thread_id: threadId } };

  return await graph.invoke(
    {
      // New message appends (reducer handles this)
      messages: [new HumanMessage(query)],

      // These fields reset on each new query
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

      // NOTE: Do NOT include detectedCompany here -
      // let clarity agent decide if it should change or persist
    },
    config
  );
}
```

**Option B: Reset Node at Entry**
Add a dedicated reset node after START that clears query-specific fields.

**Option C: Agent-Level Reset**
Have each agent reset the fields it owns. This is error-prone and harder to maintain.

#### Why Option A Works

With replace reducers (not append), passing a value in input **overwrites** the existing state. Only `messages` uses an append reducer, so it accumulates. All other fields get replaced with the input values, effectively resetting them.

```

---

## 5. Agent Specifications

### 5.1 Clarity Agent

**Purpose**: Analyze user query for clarity and extract company information.

#### Input
- `state.messages` — Full conversation history
- `state.originalQuery` — Latest user query
- `state.detectedCompany` — Previously detected company (for follow-ups)
- `state.clarificationAttempts` — Current attempt count

#### Processing Logic

```

1. Check if max clarification attempts reached
   → If yes: Force "clear" status, use best guess

2. Analyze query for company mention
   → Explicit: "Tell me about Apple" → company = "Apple"
   → Implicit: "What about their stock?" → use state.detectedCompany
   → Missing: "Tell me about the company" → needs_clarification

3. Check for follow-up indicators
   → "What about...", "Tell me more...", "And their..."
   → If follow-up AND detectedCompany exists → inherit company

4. Assess query actionability
   → Has company + clear question → "clear"
   → Has company, vague question → "clear" (Research can handle)
   → No company → "needs_clarification"

````

#### Output
```typescript
{
  clarityStatus: "clear" | "needs_clarification",
  detectedCompany: string | null,
  clarificationQuestion: string | null, // "Which company are you asking about?"
  clarificationAttempts: number, // Incremented if clarifying
  currentAgent: "clarity",
}
````

#### LLM Prompt Template

```
You are a query analysis agent. Analyze the user's query and determine:
1. Is a specific company mentioned or clearly implied?
2. Is the query clear enough to research?

Conversation history:
{messages}

Previous company context: {detectedCompany}

Latest query: {originalQuery}

Respond in JSON format:
{
  "is_clear": boolean,
  "detected_company": string | null,
  "clarification_needed": string | null, // Question to ask if unclear
  "reasoning": string // Brief explanation
}
```

### 5.2 Research Agent

**Purpose**: Fetch company information from data sources (Mock or Tavily).

#### Input

- `state.detectedCompany` — Company to research
- `state.validationFeedback` — Guidance from previous validation (if retry)
- `state.researchAttempts` — Current attempt count
- `state.messages` — Context for understanding query intent

#### Processing Logic

```
1. Increment researchAttempts

2. Build search context
   → Include validation feedback if this is a retry
   → Include original query for relevance

3. Query data source (mock or Tavily)
   → If company not found → return null findings, low confidence
   → If Tavily fails → fallback to error handling (not mock)

4. Assess confidence
   → All fields populated → 8-10
   → Some fields populated → 5-7
   → Minimal data → 1-4
   → No data → 0

5. Structure findings
```

#### Output

```typescript
{
  researchFindings: ResearchFindings | null,
  confidenceScore: number, // 0-10
  researchAttempts: number, // Incremented
  currentAgent: "research",
}
```

#### Data Source Interface

```typescript
// src/data/data-source.interface.ts

import { ResearchFindings } from "../graph/state";

/**
 * Search context for research queries.
 * Provides additional context beyond just the company name.
 */
export interface SearchContext {
  /** The original user query for relevance */
  originalQuery: string;

  /** Feedback from validator if this is a retry */
  validationFeedback?: string | null;

  /** Current attempt number for logging */
  attemptNumber: number;
}

/**
 * Result from a data source search.
 * Includes findings plus metadata about the search.
 */
export interface SearchResult {
  /** The research findings (null if nothing found) */
  findings: ResearchFindings | null;

  /** Confidence score 0-10 */
  confidence: number;

  /** Source identifier for attribution */
  source: string;

  /** Raw response for debugging */
  rawResponse?: unknown;
}

/**
 * Abstract interface for research data sources.
 * Implementations must handle their own error cases.
 */
export interface ResearchDataSource {
  /**
   * Search for company information.
   *
   * @param company - Normalized company name to search
   * @param context - Additional search context
   * @returns Search result with findings and confidence
   * @throws DataSourceError if search fails unrecoverably
   */
  search(company: string, context: SearchContext): Promise<SearchResult>;

  /**
   * Get human-readable name of this data source.
   */
  getName(): string;

  /**
   * Check if this data source is available (e.g., API key configured).
   */
  isAvailable(): boolean;
}

/**
 * Error thrown when a data source fails.
 */
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

#### Mock Data Source Implementation

```typescript
// src/data/mock-source.ts

import {
  ResearchDataSource,
  SearchContext,
  SearchResult,
  DataSourceError
} from "./data-source.interface";
import { ResearchFindings } from "../graph/state";

/**
 * Mock company research data for development and testing.
 */
const MOCK_RESEARCH_DATA: Record<
  string,
  Omit<ResearchFindings, "sources" | "rawData">
> = {
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

/**
 * Mock data source for development and testing.
 * Provides deterministic, fast responses without API calls.
 */
export class MockDataSource implements ResearchDataSource {
  getName(): string {
    return "Mock Data Source";
  }

  isAvailable(): boolean {
    return true; // Always available
  }

  async search(company: string, context: SearchContext): Promise<SearchResult> {
    // Normalize company name for lookup
    const normalizedName = this.normalizeCompanyName(company);

    // Simulate network delay for realistic testing (optional)
    // await new Promise(resolve => setTimeout(resolve, 100));

    const data = MOCK_RESEARCH_DATA[normalizedName];

    if (!data) {
      return {
        findings: null,
        confidence: 0,
        source: this.getName(),
        rawResponse: { searched: company, found: false }
      };
    }

    const findings: ResearchFindings = {
      ...data,
      sources: [this.getName()],
      rawData: {
        searchedName: company,
        normalizedTo: normalizedName,
        attemptNumber: context.attemptNumber
      }
    };

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(findings);

    return {
      findings,
      confidence,
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
    return score; // Max 10
  }
}
```

#### Tavily Data Source Implementation

```typescript
// src/data/tavily-source.ts

import { TavilySearch } from "@langchain/tavily";
import {
  ResearchDataSource,
  SearchContext,
  SearchResult,
  DataSourceError
} from "./data-source.interface";
import { ResearchFindings } from "../graph/state";
import { Logger } from "../utils/logger";

const logger = new Logger("tavily-source");

/**
 * Configuration for Tavily searches.
 */
interface TavilyConfig {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
  includeRawContent?: boolean;
}

/**
 * Tavily data source for real-time company research.
 * Uses Tavily's AI-optimized search API.
 */
export class TavilyDataSource implements ResearchDataSource {
  private tool: TavilySearch;
  private config: TavilyConfig;

  constructor(config: TavilyConfig = {}) {
    this.config = {
      maxResults: config.maxResults ?? 5,
      searchDepth: config.searchDepth ?? "advanced",
      includeAnswer: config.includeAnswer ?? true,
      includeRawContent: config.includeRawContent ?? false
    };

    this.tool = new TavilySearch({
      maxResults: this.config.maxResults,
      searchDepth: this.config.searchDepth,
      includeAnswer: this.config.includeAnswer,
      includeRawContent: this.config.includeRawContent
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
        false // Not retryable without configuration
      );
    }

    try {
      // Build optimized search query
      const query = this.buildSearchQuery(company, context);

      logger.info("Tavily search started", {
        company,
        query,
        attempt: context.attemptNumber
      });

      // Execute search
      const rawResult = await this.tool.invoke({ query });

      logger.info("Tavily search completed", {
        company,
        resultCount: Array.isArray(rawResult) ? rawResult.length : 1
      });

      // Parse results into ResearchFindings
      const findings = this.parseResults(company, rawResult);
      const confidence = this.calculateConfidence(findings, rawResult);

      return {
        findings,
        confidence,
        source: this.getName(),
        rawResponse: rawResult
      };
    } catch (error) {
      logger.error("Tavily search failed", { company, error });

      // Classify error for retry logic
      const isRetryable = this.isRetryableError(error);

      throw new DataSourceError(
        `Tavily search failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        this.getName(),
        isRetryable,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build an optimized search query for company research.
   */
  private buildSearchQuery(company: string, context: SearchContext): string {
    const baseQuery = `${company} company`;

    // Add focus areas based on context
    const focusAreas = ["latest news", "stock price", "recent developments"];

    // If we have validation feedback, incorporate it
    if (context.validationFeedback) {
      // Extract key terms from feedback
      if (context.validationFeedback.toLowerCase().includes("financial")) {
        focusAreas.push("earnings", "revenue", "financial results");
      }
      if (context.validationFeedback.toLowerCase().includes("news")) {
        focusAreas.push("breaking news", "announcements");
      }
    }

    return `${baseQuery} ${focusAreas.slice(0, 3).join(" ")}`;
  }

  /**
   * Parse Tavily results into structured ResearchFindings.
   */
  private parseResults(
    company: string,
    rawResult: unknown
  ): ResearchFindings | null {
    // Handle different response formats
    const results = this.extractResults(rawResult);

    if (!results || results.length === 0) {
      return null;
    }

    // Extract structured information from search results
    const combinedContent = results
      .map((r: any) => r.content || r.snippet || "")
      .join("\n\n");

    // Extract answer if available
    const answer = this.extractAnswer(rawResult);

    // Build findings from parsed content
    return {
      company,
      recentNews: this.extractNewsFromContent(combinedContent, answer),
      stockInfo: this.extractStockInfoFromContent(combinedContent),
      keyDevelopments: this.extractDevelopmentsFromContent(
        combinedContent,
        answer
      ),
      sources: results
        .map((r: any) => r.url || r.source || "Tavily")
        .slice(0, 5),
      rawData: { resultCount: results.length, hasAnswer: !!answer }
    };
  }

  private extractResults(rawResult: unknown): any[] {
    if (Array.isArray(rawResult)) {
      return rawResult;
    }
    if (typeof rawResult === "object" && rawResult !== null) {
      const obj = rawResult as Record<string, unknown>;
      if (Array.isArray(obj.results)) return obj.results;
      if (Array.isArray(obj.organic)) return obj.organic;
    }
    return [];
  }

  private extractAnswer(rawResult: unknown): string | null {
    if (typeof rawResult === "string") return rawResult;
    if (typeof rawResult === "object" && rawResult !== null) {
      const obj = rawResult as Record<string, unknown>;
      if (typeof obj.answer === "string") return obj.answer;
    }
    return null;
  }

  private extractNewsFromContent(
    content: string,
    answer: string | null
  ): string | null {
    // Use answer if available, otherwise extract from content
    if (answer && answer.length > 50) {
      return answer.slice(0, 500);
    }

    // Look for news-related sentences
    const sentences = content.split(/[.!?]+/);
    const newsSentences = sentences
      .filter((s) =>
        /\b(announced|launched|released|reported|unveiled|acquired|partnered)\b/i.test(
          s
        )
      )
      .slice(0, 3);

    return newsSentences.length > 0
      ? newsSentences.join(". ").slice(0, 500) + "."
      : content.slice(0, 300);
  }

  private extractStockInfoFromContent(content: string): string | null {
    // Look for stock/financial mentions
    const stockPatterns = [
      /\$[\d,.]+\s*(per share|stock|trading|price)/i,
      /trading at \$[\d,.]+/i,
      /market cap[a-z]*\s*[:of]*\s*\$?[\d,.]+\s*(billion|trillion|B|T)/i,
      /stock\s*(is\s*)?(up|down)\s*[\d.]+%/i,
      /\b(NASDAQ|NYSE|stock|shares?)\b[^.]*\$[\d,.]+/i
    ];

    for (const pattern of stockPatterns) {
      const match = content.match(pattern);
      if (match) {
        // Get surrounding context
        const matchIndex = content.indexOf(match[0]);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(
          content.length,
          matchIndex + match[0].length + 100
        );
        return content.slice(start, end).trim();
      }
    }

    return null;
  }

  private extractDevelopmentsFromContent(
    content: string,
    answer: string | null
  ): string | null {
    // Look for development-related content
    const devPatterns = [
      /\b(launched|introducing|releasing|rolling out|expanding|growing)\b/i,
      /\b(AI|artificial intelligence|machine learning|new product|innovation)\b/i,
      /\b(partnership|acquisition|merger|investment|funding)\b/i
    ];

    const sentences = content.split(/[.!?]+/);
    const devSentences = sentences
      .filter((s) => devPatterns.some((p) => p.test(s)))
      .slice(0, 4);

    return devSentences.length > 0
      ? devSentences.join(". ").slice(0, 500) + "."
      : null;
  }

  /**
   * Calculate confidence based on result quality.
   */
  private calculateConfidence(
    findings: ResearchFindings | null,
    rawResult: unknown
  ): number {
    if (!findings) return 0;

    let score = 0;

    // Content completeness
    if (findings.recentNews && findings.recentNews.length > 100) score += 3;
    else if (findings.recentNews) score += 1;

    if (findings.stockInfo) score += 3;

    if (findings.keyDevelopments && findings.keyDevelopments.length > 100)
      score += 3;
    else if (findings.keyDevelopments) score += 1;

    // Source quality
    if (findings.sources.length >= 3) score += 1;

    return Math.min(10, score);
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();

    // Rate limits are retryable
    if (message.includes("rate limit") || message.includes("429")) return true;

    // Timeouts are retryable
    if (message.includes("timeout") || message.includes("etimedout"))
      return true;

    // Server errors are retryable
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    )
      return true;

    // Auth errors are NOT retryable
    if (
      message.includes("401") ||
      message.includes("403") ||
      message.includes("api key")
    )
      return false;

    return false;
  }
}
```

#### Data Source Factory

```typescript
// src/data/index.ts

import { ResearchDataSource } from "./data-source.interface";
import { MockDataSource } from "./mock-source";
import { TavilyDataSource } from "./tavily-source";
import { Logger } from "../utils/logger";

const logger = new Logger("data-source");

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
    type = (process.env.RESEARCH_DATA_SOURCE as DataSourceType) ?? "mock";

    // If Tavily requested but not available, warn and fall back
    if (type === "tavily" && !process.env.TAVILY_API_KEY) {
      logger.warn(
        "Tavily requested but TAVILY_API_KEY not set, falling back to mock"
      );
      type = "mock";
    }
  }

  switch (type) {
    case "tavily":
      logger.info("Using Tavily data source");
      return new TavilyDataSource();

    case "mock":
    default:
      logger.info("Using Mock data source");
      return new MockDataSource();
  }
}

// Re-export for convenience
export { MockDataSource } from "./mock-source";
export { TavilyDataSource } from "./tavily-source";
export {
  ResearchDataSource,
  SearchContext,
  SearchResult,
  DataSourceError
} from "./data-source.interface";
```

#### Research Agent with Data Source

```typescript
// src/agents/research.agent.ts (excerpt)

import { ResearchState } from "../graph/state";
import { ResearchDataSource, DataSourceError } from "../data";
import { Logger } from "../utils/logger";

const logger = new Logger("research-agent");

/**
 * Create a research agent with the specified data source.
 */
export function createResearchAgent(dataSource: ResearchDataSource) {
  return async function researchAgent(
    state: ResearchState
  ): Promise<Partial<ResearchState>> {
    const attemptNumber = state.researchAttempts + 1;

    logger.info("Research started", {
      company: state.detectedCompany,
      attempt: attemptNumber,
      dataSource: dataSource.getName()
    });

    // Early exit if no company
    if (!state.detectedCompany) {
      return {
        researchFindings: null,
        confidenceScore: 0,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    }

    try {
      const result = await dataSource.search(state.detectedCompany, {
        originalQuery: state.originalQuery,
        validationFeedback: state.validationFeedback,
        attemptNumber
      });

      logger.info("Research completed", {
        company: state.detectedCompany,
        confidence: result.confidence,
        source: result.source
      });

      return {
        researchFindings: result.findings,
        confidenceScore: result.confidence,
        researchAttempts: attemptNumber,
        currentAgent: "research"
      };
    } catch (error) {
      // Handle data source errors gracefully
      if (error instanceof DataSourceError) {
        logger.error("Data source error", {
          source: error.source,
          retryable: error.isRetryable,
          message: error.message
        });

        // Return null findings but don't crash
        return {
          researchFindings: null,
          confidenceScore: 0,
          researchAttempts: attemptNumber,
          currentAgent: "research"
        };
      }

      // Re-throw unexpected errors
      throw error;
    }
  };
}
```

### 5.3 Validator Agent

**Purpose**: Assess research quality and completeness.

#### Input

- `state.researchFindings` — Data to validate
- `state.originalQuery` — What user actually asked
- `state.confidenceScore` — Research Agent's self-assessment

#### Processing Logic

```
1. Check if findings exist
   → If null → "insufficient", feedback: "No data found"

2. Assess relevance to query
   → Does the data answer what was asked?
   → Are there obvious gaps?

3. Assess completeness
   → Are all key fields populated?
   → Is the data specific or generic?

4. Generate feedback for retry
   → Be specific: "Missing financial data" not "Incomplete"
```

#### Output

```typescript
{
  validationResult: "sufficient" | "insufficient",
  validationFeedback: string | null, // Guidance for retry
  currentAgent: "validator",
}
```

#### LLM Prompt Template

```
You are a research quality validator. Assess whether the research findings
adequately answer the user's question.

Original query: {originalQuery}
Research findings: {researchFindings}
Confidence score: {confidenceScore}

Evaluate:
1. Relevance: Does this data address what was asked?
2. Completeness: Are there obvious gaps?
3. Quality: Is the information specific and useful?

Respond in JSON format:
{
  "is_sufficient": boolean,
  "feedback": string | null, // Specific guidance if insufficient
  "reasoning": string
}
```

### 5.4 Synthesis Agent

**Purpose**: Generate user-friendly response from research findings.

#### Input

- `state.researchFindings` — Data to summarize
- `state.originalQuery` — User's question
- `state.messages` — Conversation context
- `state.confidenceScore` — For calibrating language
- `state.validationResult` — For graceful degradation messaging
- `state.researchAttempts` — For context on data quality

#### Processing Logic

```
1. Determine confidence prefix
   → High confidence (8+): No qualifier
   → Medium (6-7): Standard response
   → Low (<6): "Based on limited information..."
   → Max attempts reached: "Note: I was unable to fully verify..."

2. Handle no-data case
   → Return apologetic message with suggestions

3. Generate structured summary
   → Overview paragraph
   → Key developments
   → Financial snapshot (if available)
   → Context-appropriate tone

4. Add response to messages
   → For multi-turn continuity
```

#### Output

```typescript
{
  finalSummary: string,
  messages: [new AIMessage(summary)], // Appended
  currentAgent: "synthesis",
}
```

#### Response Structure

```markdown
# For successful research:

Here's what I found about {company}:

{overview paragraph based on key developments}

**Recent News**: {recentNews}

**Financial Snapshot**: {stockInfo}

---

# For low confidence:

Based on limited available information about {company}:

{whatever data is available}

Note: I wasn't able to find comprehensive data on this company.
Would you like me to try searching for related information?

---

# For no data:

I couldn't find specific information about "{query}".

This might be because:

- The company name wasn't recognized
- Limited data is available in my sources

Could you provide more details or check the spelling?
```

---

## 6. Routing Logic

### 6.1 Router Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROUTING DIAGRAM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START ──────────────────────► CLARITY                                       │
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    │                               │                        │
│              clarityRouter                   clarityRouter                  │
│              returns "research"              returns "interrupt"            │
│                    │                               │                        │
│                    ▼                               ▼                        │
│               RESEARCH                        INTERRUPT                     │
│                    │                               │                        │
│                    │                          (on resume)                   │
│                    │                               │                        │
│     ┌──────────────┴──────────────┐               │                        │
│     │                             │               │                        │
│ researchRouter             researchRouter         │                        │
│ returns "synthesis"        returns "validator"    │                        │
│     │                             │               │                        │
│     │                             ▼               │                        │
│     │                        VALIDATOR            │                        │
│     │                             │               │                        │
│     │          ┌──────────────────┴────────┐      │                        │
│     │          │                           │      │                        │
│     │   validationRouter            validationRouter                       │
│     │   returns "synthesis"         returns "research"                     │
│     │          │                           │      │                        │
│     │          │                           │      │                        │
│     │          │                    ┌──────┘      │                        │
│     │          │                    │             │                        │
│     ▼          ▼                    ▼             │                        │
│  SYNTHESIS ◄────────────────── RESEARCH ◄────────┘                        │
│     │                          (retry)        (loops back                  │
│     │                                          to CLARITY)                 │
│     ▼                                                                       │
│    END                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Router Implementations

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const CONFIDENCE_THRESHOLD = 6;
export const MAX_RESEARCH_ATTEMPTS = 3;
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/**
 * CLARIFICATION ATTEMPTS EXPLAINED:
 *
 * MAX_CLARIFICATION_ATTEMPTS = 2 means the user gets 2 chances to clarify
 * before the system proceeds with a best guess.
 *
 * Flow:
 * - Run 1: clarificationAttempts = 0, check fails (0 >= 2), if unclear → set to 1, interrupt
 * - Run 2: clarificationAttempts = 1, check fails (1 >= 2), if unclear → set to 2, interrupt
 * - Run 3: clarificationAttempts = 2, check passes (2 >= 2), force proceed with best guess
 *
 * So the user gets exactly 2 interrupt-resume cycles to provide clarification.
 */

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER 1: CLARITY DECISION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Routes from Clarity Agent based on query clarity.
 *
 * Decision Logic:
 * - needs_clarification → interrupt (ask user)
 * - clear → research (proceed with query)
 *
 * @param state - Current graph state
 * @returns Next node name
 */
export function clarityRouter(state: ResearchState): "interrupt" | "research" {
  if (state.clarityStatus === "needs_clarification") {
    return "interrupt";
  }
  return "research";
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER 2: RESEARCH CONFIDENCE DECISION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Routes from Research Agent based on confidence score.
 *
 * Decision Logic:
 * - confidence >= 6 → synthesis (high confidence, skip validation)
 * - confidence < 6 → validator (needs quality check)
 *
 * @param state - Current graph state
 * @returns Next node name
 */
export function researchRouter(
  state: ResearchState
): "validator" | "synthesis" {
  if (state.confidenceScore >= CONFIDENCE_THRESHOLD) {
    return "synthesis";
  }
  return "validator";
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER 3: VALIDATION LOOP DECISION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Routes from Validator Agent based on validation result and attempt count.
 *
 * Decision Logic:
 * - insufficient AND attempts < 3 → research (retry with feedback)
 * - sufficient OR attempts >= 3 → synthesis (proceed with what we have)
 *
 * This is the critical loop protection router.
 *
 * @param state - Current graph state
 * @returns Next node name
 */
export function validationRouter(
  state: ResearchState
): "research" | "synthesis" {
  const canRetry = state.researchAttempts < MAX_RESEARCH_ATTEMPTS;
  const needsMoreResearch = state.validationResult === "insufficient";

  if (needsMoreResearch && canRetry) {
    // Loop back for another attempt
    return "research";
  }

  // Either sufficient OR max attempts reached → proceed
  return "synthesis";
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER 4: INTERRUPT RESUME (Edge, not conditional)
// ═══════════════════════════════════════════════════════════════════════════

// Note: This is implemented as a fixed edge, not a conditional router.
// After interrupt resumes, we ALWAYS go back to clarity for re-analysis.
// This handles edge cases like still-vague clarifications or topic changes.
```

### 6.3 Routing Decision Matrix

| Current Node | Condition                                                         | Next Node | Rationale                          |
| ------------ | ----------------------------------------------------------------- | --------- | ---------------------------------- |
| START        | Always                                                            | clarity   | Entry point                        |
| clarity      | `clarityStatus === "needs_clarification"`                         | interrupt | Need user input                    |
| clarity      | `clarityStatus === "clear"`                                       | research  | Proceed with query                 |
| interrupt    | Resume received                                                   | clarity   | Re-analyze with new info           |
| research     | `confidenceScore >= 6`                                            | synthesis | High confidence, skip validation   |
| research     | `confidenceScore < 6`                                             | validator | Needs quality check                |
| validator    | `validationResult === "sufficient"`                               | synthesis | Good enough                        |
| validator    | `validationResult === "insufficient"` AND `researchAttempts >= 3` | synthesis | Max attempts, graceful degradation |
| validator    | `validationResult === "insufficient"` AND `researchAttempts < 3`  | research  | Retry with feedback                |
| synthesis    | Always                                                            | END       | Terminal node                      |

---

## 7. Graph Structure

### 7.1 Graph Definition

```typescript
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { ResearchStateAnnotation, ResearchState } from "./state";
import {
  clarityAgent,
  clarificationInterrupt,
  researchAgent,
  validatorAgent,
  synthesisAgent
} from "./agents";
import { clarityRouter, researchRouter, validationRouter } from "./routers";

/**
 * Builds and compiles the Research Assistant workflow graph.
 *
 * @returns Compiled graph ready for invocation
 */
export function buildResearchGraph() {
  // ─────────────────────────────────────────────────────────────────────────
  // GRAPH CONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────

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
      research: "research", // Loop back for retry
      synthesis: "synthesis" // Proceed to output
    })

    // ─── Synthesis Terminal Edge ───
    .addEdge("synthesis", END);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPILATION
  // ─────────────────────────────────────────────────────────────────────────

  const checkpointer = new MemorySaver();

  // NOTE: We do NOT use interruptBefore/interruptAfter here.
  // Those are for debugging breakpoints, NOT for human-in-the-loop workflows.
  // The interrupt() function inside the "interrupt" node handles the pause.
  return workflow.compile({ checkpointer });
}
```

### 7.2 Visual Representation

```
                    ┌─────────────────────────────────────────────┐
                    │            RESEARCH ASSISTANT               │
                    │              WORKFLOW GRAPH                 │
                    └─────────────────────────────────────────────┘

                                      START
                                        │
                                        ▼
                              ┌─────────────────┐
                              │    CLARITY      │
                              │     AGENT       │
                              └────────┬────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                    clear│                           │needs_clarification
                         │                           │
                         ▼                           ▼
               ┌─────────────────┐         ┌─────────────────┐
               │    RESEARCH     │         │   INTERRUPT     │
               │     AGENT       │         │   (await user)  │
               └────────┬────────┘         └────────┬────────┘
                        │                           │
                        │                           │ resume
          ┌─────────────┴─────────────┐             │
          │                           │             │
  conf≥6  │                           │ conf<6      │
          │                           │             │
          │                           ▼             │
          │                 ┌─────────────────┐     │
          │                 │   VALIDATOR     │     │
          │                 │     AGENT       │     │
          │                 └────────┬────────┘     │
          │                          │              │
          │         ┌────────────────┴────────┐     │
          │         │                         │     │
          │ sufficient OR                     │insufficient AND
          │ max_attempts                      │attempts < 3
          │         │                         │     │
          │         ▼                         │     │
          │         │                         │     │
          ▼         ▼                         ▼     │
        ┌─────────────────┐          ┌─────────┐   │
        │   SYNTHESIS     │◄─────────│  LOOP   │   │
        │     AGENT       │          │  BACK   │───┘
        └────────┬────────┘          └─────────┘
                 │
                 ▼
                END
```

---

## 8. Human-in-the-Loop Design

### 8.1 Interrupt Mechanism

The interrupt node pauses graph execution and waits for user input.

> ⚠️ **CRITICAL BEHAVIOR**: When resuming from an interrupt, the **entire node re-executes from the beginning**, not from the `interrupt()` call. Any code before `interrupt()` runs again on every resume. Ensure code before `interrupt()` is **idempotent** (produces the same result when run multiple times).

```typescript
import { interrupt } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Interrupt node that pauses for user clarification.
 *
 * IMPORTANT: This entire function re-executes when resumed!
 *
 * When this node executes:
 * 1. Graph execution reaches this node
 * 2. Code before interrupt() runs (WILL RUN AGAIN ON RESUME)
 * 3. interrupt() is called, graph pauses
 * 4. Interrupt payload is returned to client via __interrupt__
 * 5. Client displays question to user
 * 6. User provides response
 * 7. Client resumes with Command({ resume: userResponse })
 * 8. NODE RESTARTS FROM BEGINNING (code before interrupt() runs again)
 * 9. interrupt() returns the resume value
 * 10. Code after interrupt() runs
 * 11. Graph continues to next node
 *
 * @param state - Current graph state
 * @returns Updated state with user's clarification
 */
export async function clarificationInterrupt(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  // ⚠️ This code runs on EVERY execution (initial + every resume)
  // Keep it idempotent - no side effects like API calls or DB writes!
  const interruptPayload = {
    type: "clarification_needed",
    question:
      state.clarificationQuestion ?? "Could you please clarify your question?",
    originalQuery: state.originalQuery,
    attempt: state.clarificationAttempts
  };

  // This call pauses execution until resume is called
  // On resume, this returns the value from Command({ resume: value })
  const userResponse = interrupt(interruptPayload);

  // ✅ This code ONLY runs after resume (when userResponse is available)
  return {
    // Add the clarification as a new human message
    messages: [new HumanMessage(userResponse as string)],

    // Update the query to the clarified version
    originalQuery: userResponse as string,

    // Reset clarity status for re-analysis
    clarityStatus: "pending",

    currentAgent: "interrupt"
  };
}
```

### 8.2 Client-Side Handling

```typescript
import { Command } from "@langchain/langgraph";

async function runConversation() {
  const graph = buildResearchGraph();
  const threadId = crypto.randomUUID();
  const config = { configurable: { thread_id: threadId } };

  // Initial query
  let result = await graph.invoke(
    {
      messages: [new HumanMessage("Tell me about the company")],
      originalQuery: "Tell me about the company"
    },
    config
  );

  // Check if we're interrupted
  while (result.__interrupt__) {
    const interruptData = result.__interrupt__[0].value;

    console.log(`\n🤔 ${interruptData.question}`);
    const userResponse = await getUserInput(); // readline or similar

    // Resume with user's response
    result = await graph.invoke(new Command({ resume: userResponse }), config);
  }

  // Final result
  console.log(`\n📊 ${result.finalSummary}`);
}
```

### 8.3 Interrupt Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTERRUPT FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLIENT                              GRAPH                                   │
│    │                                   │                                     │
│    │  invoke({ query: "Tell me        │                                     │
│    │         about the company" })    │                                     │
│    │─────────────────────────────────►│                                     │
│    │                                   │                                     │
│    │                                   ▼                                     │
│    │                           ┌──────────────┐                             │
│    │                           │   CLARITY    │                             │
│    │                           │   detects    │                             │
│    │                           │   unclear    │                             │
│    │                           └──────┬───────┘                             │
│    │                                  │                                      │
│    │                                  ▼                                      │
│    │                           ┌──────────────┐                             │
│    │                           │  INTERRUPT   │                             │
│    │                           │   node       │                             │
│    │                           │  (pauses)    │                             │
│    │                           └──────┬───────┘                             │
│    │                                  │                                      │
│    │◄─────────────────────────────────┤                                     │
│    │  returns {                       │                                     │
│    │    __interrupt__: [{             │                                     │
│    │      value: {                    │                                     │
│    │        question: "Which          │                                     │
│    │          company?"               │                                     │
│    │      }                           │                                     │
│    │    }]                            │                                     │
│    │  }                               │                                     │
│    │                                  │                                     │
│    │  (User types "Apple")            │                                     │
│    │                                  │                                     │
│    │  invoke(Command({                │                                     │
│    │    resume: "Apple"               │                                     │
│    │  }), config)                     │                                     │
│    │─────────────────────────────────►│                                     │
│    │                                  │                                     │
│    │                                  ▼                                      │
│    │                           ┌──────────────┐                             │
│    │                           │  INTERRUPT   │                             │
│    │                           │  resumes,    │                             │
│    │                           │  returns     │                             │
│    │                           │  "Apple"     │                             │
│    │                           └──────┬───────┘                             │
│    │                                  │                                      │
│    │                                  ▼                                      │
│    │                           ┌──────────────┐                             │
│    │                           │   CLARITY    │                             │
│    │                           │   (re-run)   │                             │
│    │                           │   → clear!   │                             │
│    │                           └──────┬───────┘                             │
│    │                                  │                                      │
│    │                                  ▼                                      │
│    │                           (continues to RESEARCH...)                   │
│    │                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Idempotency Requirements

> ⚠️ **CRITICAL**: Any code that runs BEFORE `interrupt()` will re-execute on every resume. This has important implications for side effects.

#### ✅ Safe Operations Before `interrupt()`

```typescript
// These are idempotent - safe to repeat
const payload = { question: state.clarificationQuestion }; // Just reading state
const formatted = `Please clarify: ${state.originalQuery}`; // Pure computation
console.log("Interrupt triggered"); // Logging (side effect, but harmless)
```

#### ❌ Dangerous Operations Before `interrupt()`

```typescript
// These will execute multiple times - DO NOT DO THIS!
await db.insertRecord({ ... });      // Creates duplicates!
await sendEmail(user, "Clarify?");   // Sends multiple emails!
counter++;                           // Counter increments incorrectly!
await externalApi.createResource();  // Creates duplicate resources!
```

#### Best Practice

Put all side effects AFTER the `interrupt()` call, or in a separate node that runs after the interrupt node completes.

---

## 9. Multi-Turn Conversation Handling

### 9.1 Context Preservation Strategy

| Scenario                       | Mechanism                                    | Example                                |
| ------------------------------ | -------------------------------------------- | -------------------------------------- |
| **Initial query**              | Stored in `messages` and `originalQuery`     | "What's happening with Apple?"         |
| **Follow-up with pronoun**     | `detectedCompany` provides context           | "What about their stock?"              |
| **Follow-up with new company** | Updates `detectedCompany`, preserves history | "Now tell me about Tesla"              |
| **"Tell me more"**             | `messages` history + `researchFindings`      | "Tell me more about their AI strategy" |
| **Long conversation**          | `conversationSummary` condenses history      | (After 10+ messages)                   |

### 9.2 Follow-Up Detection

The Clarity Agent detects follow-up queries using pattern matching:

```typescript
const FOLLOW_UP_PATTERNS = [
  // Continuation phrases
  /^(what about|tell me more|how about|and|also|furthermore)/i,

  // Pronoun references
  /^(their|its|the company's|they|them)/i,

  // Comparison requests
  /^(compare|versus|vs\.?|compared to)/i,

  // Elaboration requests
  /^(explain|elaborate|expand on|go deeper)/i,

  // Context-dependent questions
  /^(why|how|when did|is that|are they)/i
];

function isFollowUp(query: string, hasExistingCompany: boolean): boolean {
  if (!hasExistingCompany) return false;
  return FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(query.trim()));
}
```

### 9.3 Multi-Turn Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TURN CONVERSATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TURN 1                                                                      │
│  ───────                                                                     │
│  User: "What's happening with Apple?"                                        │
│  State: {                                                                    │
│    messages: [HumanMessage("What's happening with Apple?")],                │
│    originalQuery: "What's happening with Apple?",                           │
│    detectedCompany: "Apple Inc.",                                           │
│  }                                                                           │
│  Response: "Here's what I found about Apple Inc. ..."                       │
│  State after: {                                                              │
│    messages: [HumanMessage(...), AIMessage(summary)],                       │
│    detectedCompany: "Apple Inc.",  // Persisted!                            │
│    finalSummary: "Here's what I found...",                                  │
│  }                                                                           │
│                                                                              │
│  TURN 2 (Follow-up)                                                          │
│  ──────────────────                                                          │
│  User: "What about their competitors?"                                       │
│  State: {                                                                    │
│    messages: [...previous, HumanMessage("What about their competitors?")], │
│    originalQuery: "What about their competitors?",                          │
│    detectedCompany: "Apple Inc.",  // Inherited from Turn 1!                │
│  }                                                                           │
│  Clarity Agent: Detects follow-up pattern, keeps "Apple Inc."               │
│  Research Agent: Searches for "Apple Inc. competitors"                      │
│  Response: "Apple's main competitors include Samsung, Google..."            │
│                                                                              │
│  TURN 3 (New company)                                                        │
│  ────────────────────                                                        │
│  User: "Now tell me about Tesla"                                            │
│  State: {                                                                    │
│    messages: [...all previous messages],                                    │
│    originalQuery: "Now tell me about Tesla",                                │
│    detectedCompany: "Tesla, Inc.",  // Updated!                             │
│  }                                                                           │
│  Clarity Agent: Detects explicit company mention, updates context           │
│  Research Agent: Searches for "Tesla, Inc."                                 │
│  Response: "Here's what I found about Tesla..."                             │
│                                                                              │
│  TURN 4 (Comparison)                                                         │
│  ────────────────────                                                        │
│  User: "Compare them to Apple"                                              │
│  State: {                                                                    │
│    messages: [...all previous, with Apple and Tesla info],                  │
│    originalQuery: "Compare them to Apple",                                  │
│    detectedCompany: "Tesla, Inc.",  // Current focus                        │
│  }                                                                           │
│  Clarity Agent: Detects comparison, has both in history                     │
│  Synthesis Agent: Uses full message history for comparison                  │
│  Response: "Comparing Tesla and Apple: ..."                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Thread Management

```typescript
// Each conversation is a "thread" with a unique ID
const threadId = crypto.randomUUID();

// All invocations in the same thread share state
const config = { configurable: { thread_id: threadId } };

// Turn 1
await graph.invoke(
  { messages: [new HumanMessage("What's happening with Apple?")], ... },
  config
);

// Turn 2 - same thread_id, state persists
await graph.invoke(
  { messages: [new HumanMessage("What about their stock?")], ... },
  config
);

// Different thread - fresh state
const newConfig = { configurable: { thread_id: crypto.randomUUID() } };
await graph.invoke(
  { messages: [new HumanMessage("Tell me about Tesla")], ... },
  newConfig
);
```

---

## 10. Beyond Expected Features

> **Note**: Tavily integration is now a **core feature**, not a "beyond" feature. The architecture supports both Mock and Tavily data sources out of the box.

### 10.1 Feature Overview

| Feature                     | Impact             | Effort | Priority | Status           |
| --------------------------- | ------------------ | ------ | -------- | ---------------- |
| **Tavily Real-Time Search** | High Value         | Medium | ✅ Core  | Included in base |
| Streaming Responses         | High UX            | Medium | ✅ P0    | Beyond           |
| LangSmith Integration       | High Debuggability | Low    | ✅ P0    | Beyond           |
| Graceful Degradation        | High Reliability   | Medium | ✅ P1    | Beyond           |
| Conversation Summarization  | Medium             | Medium | ✅ P2    | Beyond           |

### 10.2 Streaming Responses

**Purpose**: Show real-time progress through agents and stream final synthesis.

```typescript
// Stream agent-level updates
const stream = await graph.stream(
  { messages: [new HumanMessage(userInput)], ... },
  {
    configurable: { thread_id },
    streamMode: "updates",
  }
);

for await (const update of stream) {
  // Each update is an object like { "nodeName": { ...nodeOutput } }
  const entries = Object.entries(update);
  if (entries.length === 0) continue;

  const [nodeName, nodeOutput] = entries[0];

  // Show progress indicator
  switch (nodeName) {
    case "clarity":
      console.log("🔍 Analyzing your query...");
      break;
    case "research":
      console.log(`📚 Researching ${(nodeOutput as any).detectedCompany}...`);
      break;
    case "validator":
      console.log("✅ Validating findings...");
      break;
    case "synthesis":
      console.log("📝 Generating summary...\n");
      // Stream the actual content
      process.stdout.write((nodeOutput as any).finalSummary);
      break;
  }
}
```

**Alternative: Token-Level Streaming for Synthesis**

```typescript
// For token-by-token streaming of the synthesis
const stream = await graph.stream(input, {
  configurable: { thread_id },
  streamMode: "messages"
});

for await (const [message, metadata] of stream) {
  if (metadata.langgraph_node === "synthesis") {
    // Stream tokens as they arrive
    process.stdout.write(message.content);
  }
}
```

### 10.3 LangSmith Integration

**Purpose**: Automatic tracing for debugging and observability.

**Setup** (zero code changes):

```bash
# .env file
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key_here
LANGCHAIN_PROJECT=research-assistant
```

**What Gets Traced**:

- Every node execution with input/output
- LLM calls with prompts and responses
- State transitions and routing decisions
- Timing information for performance analysis
- Error traces with full context

**Usage in README**:

````markdown
## Observability with LangSmith

To enable detailed tracing:

1. Get an API key from [smith.langchain.com](https://smith.langchain.com)
2. Set environment variables:
   ```bash
   export LANGCHAIN_TRACING_V2=true
   export LANGCHAIN_API_KEY=your_key
   export LANGCHAIN_PROJECT=research-assistant
   ```
````

3. Run the application - all executions are now traced
4. View traces at smith.langchain.com/project/research-assistant

````

### 10.4 Graceful Degradation

**Purpose**: Provide useful responses even when research fails or is incomplete.

**Implementation in Synthesis Agent**:

```typescript
async function synthesisAgent(state: ResearchState): Promise<Partial<ResearchState>> {
  const {
    researchFindings,
    confidenceScore,
    researchAttempts,
    validationResult,
    detectedCompany,
    originalQuery,
  } = state;

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 1: No data at all
  // ─────────────────────────────────────────────────────────────────────────
  if (!researchFindings || !researchFindings.company) {
    const noDataResponse = `I couldn't find specific information about "${detectedCompany || originalQuery}".

This might be because:
- The company name wasn't recognized in my sources
- Limited public data is available

Would you like to:
- Try a different spelling or the full company name?
- Ask about a related company?`;

    return {
      finalSummary: noDataResponse,
      messages: [new AIMessage(noDataResponse)],
      currentAgent: "synthesis",
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 2: Partial data (low confidence or max retries)
  // ─────────────────────────────────────────────────────────────────────────
  let confidencePrefix = "";

  if (confidenceScore < 4) {
    confidencePrefix = "⚠️ **Note**: Based on limited available information:\n\n";
  } else if (validationResult === "insufficient" && researchAttempts >= MAX_RESEARCH_ATTEMPTS) {
    confidencePrefix = "ℹ️ *I found some information, but couldn't verify all details:*\n\n";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE 3: Generate summary with available data
  // ─────────────────────────────────────────────────────────────────────────
  const summary = await generateSummaryWithLLM(state, confidencePrefix);

  return {
    finalSummary: summary,
    messages: [new AIMessage(summary)],
    currentAgent: "synthesis",
  };
}
````

### 10.5 Conversation Summarization

**Purpose**: Keep context manageable for long conversations.

**Trigger Condition**: Message count > 10

```typescript
const MESSAGE_THRESHOLD = 10;
const MESSAGES_TO_KEEP = 4; // Keep last 4 messages unsummarized

async function maybeSummarizeConversation(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  if (state.messages.length <= MESSAGE_THRESHOLD) {
    return {}; // No summarization needed
  }

  const messagesToSummarize = state.messages.slice(0, -MESSAGES_TO_KEEP);
  const recentMessages = state.messages.slice(-MESSAGES_TO_KEEP);

  // Combine existing summary with new messages to summarize
  const contextToSummarize = state.conversationSummary
    ? `Previous context: ${
        state.conversationSummary
      }\n\nNew messages:\n${formatMessages(messagesToSummarize)}`
    : formatMessages(messagesToSummarize);

  const summary = await llm.invoke([
    new SystemMessage(`Summarize this conversation history concisely. 
Preserve:
- Company names discussed
- Key facts learned
- User's interests and follow-up patterns

Be brief but complete.`),
    new HumanMessage(contextToSummarize)
  ]);

  return {
    conversationSummary: summary.content as string,
    messages: recentMessages // Replace with trimmed messages
  };
}
```

**Integration Point**: Called at the start of Clarity Agent or as a separate node.

---

## 11. Error Handling & Edge Cases

### 11.1 Error Categories

| Category             | Example                 | Handling Strategy                                     |
| -------------------- | ----------------------- | ----------------------------------------------------- |
| **User Input**       | Empty query, gibberish  | Clarity Agent detects, requests clarification         |
| **Data Source**      | API timeout, rate limit | Retry with backoff, then graceful degradation         |
| **LLM Failure**      | Token limit, API error  | Fallback response, log for debugging                  |
| **State Corruption** | Invalid field values    | Validation at node entry, reset to defaults           |
| **Infinite Loops**   | Validation never passes | Hard limits on attempts (3 research, 2 clarification) |

### 11.2 Edge Case Handling

```typescript
// ─────────────────────────────────────────────────────────────────────────
// Edge Case: Empty messages array or no new message
// ─────────────────────────────────────────────────────────────────────────
if (!state.messages || state.messages.length === 0) {
  return {
    clarityStatus: "needs_clarification",
    clarificationQuestion:
      "Hello! What would you like to know about a company?",
    clarificationAttempts: state.clarificationAttempts + 1
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Edge Case: Empty or whitespace-only query
// ─────────────────────────────────────────────────────────────────────────
if (!state.originalQuery?.trim()) {
  return {
    clarityStatus: "needs_clarification",
    clarificationQuestion: "I didn't catch that. What would you like to know?",
    clarificationAttempts: state.clarificationAttempts + 1
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Edge Case: Company not in mock data
// ─────────────────────────────────────────────────────────────────────────
const findings = mockDataSource.search(company);
if (!findings) {
  return {
    researchFindings: {
      company,
      recentNews: null,
      stockInfo: null,
      keyDevelopments: null,
      sources: [],
      rawData: {}
    },
    confidenceScore: 0, // Forces validation
    researchAttempts: state.researchAttempts + 1
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Edge Case: User says "nevermind" or "cancel"
// ─────────────────────────────────────────────────────────────────────────
const CANCEL_PATTERNS = [
  /^(nevermind|never mind|cancel|stop|quit|exit|forget it)/i
];

if (CANCEL_PATTERNS.some((p) => p.test(state.originalQuery))) {
  return {
    clarityStatus: "clear", // Skip to synthesis
    researchFindings: null, // No research needed
    finalSummary:
      "No problem! Let me know if you'd like to research anything else."
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Edge Case: Max clarification attempts reached
// ─────────────────────────────────────────────────────────────────────────
if (state.clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
  return {
    clarityStatus: "clear", // Force proceed
    detectedCompany: extractBestGuess(state.originalQuery) // Try our best
    // Synthesis will handle the graceful degradation
  };
}
```

### 11.3 Error Logging

```typescript
import { Logger } from "./utils/logger";

const logger = new Logger("research-assistant");

// In each agent
async function researchAgent(state: ResearchState) {
  logger.info("Research agent started", {
    company: state.detectedCompany,
    attempt: state.researchAttempts + 1,
  });

  try {
    const findings = await dataSource.search(state.detectedCompany);

    logger.info("Research completed", {
      company: state.detectedCompany,
      confidence: calculateConfidence(findings),
      hasNews: !!findings?.recentNews,
    });

    return { ... };

  } catch (error) {
    logger.error("Research failed", {
      company: state.detectedCompany,
      error: error.message,
      stack: error.stack,
    });

    // Graceful degradation
    return {
      researchFindings: null,
      confidenceScore: 0,
      researchAttempts: state.researchAttempts + 1,
    };
  }
}
```

---

## 12. Project Structure

```
research-assistant/
├── src/
│   ├── agents/
│   │   ├── index.ts              # Agent exports
│   │   ├── clarity.agent.ts      # Query analysis, company detection
│   │   ├── research.agent.ts     # Data fetching (uses injected data source)
│   │   ├── validator.agent.ts    # Quality assessment
│   │   ├── synthesis.agent.ts    # Response generation
│   │   └── interrupt.agent.ts    # Clarification interrupt handler
│   │
│   ├── graph/
│   │   ├── index.ts              # Graph builder export
│   │   ├── state.ts              # State annotation + ResearchFindings interface
│   │   ├── workflow.ts           # Graph construction
│   │   └── routers.ts            # Conditional edge functions
│   │
│   ├── data/
│   │   ├── index.ts              # Data source factory + exports
│   │   ├── data-source.interface.ts  # ResearchDataSource interface
│   │   ├── mock-source.ts        # Mock data implementation
│   │   ├── mock-data.ts          # Company mock data constants
│   │   └── tavily-source.ts      # Tavily API implementation
│   │
│   ├── prompts/
│   │   ├── index.ts              # Prompt exports
│   │   ├── clarity.prompts.ts    # Clarity agent prompts
│   │   ├── validator.prompts.ts  # Validator prompts
│   │   └── synthesis.prompts.ts  # Synthesis prompts
│   │
│   ├── utils/
│   │   ├── logger.ts             # Structured logging
│   │   ├── patterns.ts           # Regex patterns for detection
│   │   └── config.ts             # Configuration constants + env loading
│   │
│   └── index.ts                  # Entry point, conversation loop
│
├── tests/
│   ├── agents/
│   │   ├── clarity.test.ts       # Clarity agent unit tests
│   │   ├── research.test.ts      # Research agent unit tests
│   │   ├── validator.test.ts     # Validator unit tests
│   │   └── synthesis.test.ts     # Synthesis unit tests
│   │
│   ├── data/
│   │   ├── mock-source.test.ts   # Mock data source tests
│   │   └── tavily-source.test.ts # Tavily integration tests (skipped without API key)
│   │
│   ├── integration/
│   │   ├── happy-path.test.ts    # Full flow tests
│   │   ├── clarification.test.ts # Interrupt flow tests
│   │   ├── retry-loop.test.ts    # Validation loop tests
│   │   └── multi-turn.test.ts    # Conversation tests
│   │
│   └── fixtures/
│       ├── queries.ts            # Test query fixtures
│       └── states.ts             # Test state fixtures
│
├── docs/
│   └── ARCHITECTURE.md           # This document
│
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts              # Test configuration
└── README.md                     # Setup and usage instructions
```

### 12.1 File Responsibilities

| File                                | Responsibility                                                           |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `src/graph/state.ts`                | Single source of truth for state schema AND `ResearchFindings` interface |
| `src/graph/workflow.ts`             | Graph construction, node/edge definitions                                |
| `src/graph/routers.ts`              | All conditional routing logic                                            |
| `src/agents/*.ts`                   | Individual agent implementations (one per file)                          |
| `src/data/index.ts`                 | Data source factory, exports, auto-detection logic                       |
| `src/data/data-source.interface.ts` | `ResearchDataSource` interface for dependency injection                  |
| `src/data/mock-source.ts`           | Mock implementation with built-in company data                           |
| `src/data/tavily-source.ts`         | Tavily API implementation with result parsing                            |
| `src/prompts/*.ts`                  | LLM prompt templates (separated for easy iteration)                      |
| `src/utils/config.ts`               | Environment variable loading and validation                              |
| `src/index.ts`                      | CLI entry point with conversation loop                                   |

---

## 13. Test Scenarios

### 13.1 Required Test Cases

| #   | Scenario             | Input                                              | Expected Flow                                         | Expected Output                |
| --- | -------------------- | -------------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| 1   | Happy Path           | "What's happening with Apple?"                     | Clarity→Research→Synthesis                            | Apple summary                  |
| 2   | Clarification        | "Tell me about the company"                        | Clarity→Interrupt→(resume)→Clarity→Research→Synthesis | Clarified company summary      |
| 3   | Double Clarification | "Tell me about the company"→"The tech one"→"Apple" | Two interrupts, then research                         | Apple summary                  |
| 4   | Low Confidence       | "What's happening with Acme Corp?"                 | Clarity→Research→Validator→Synthesis                  | Graceful degradation message   |
| 5   | Retry Loop           | Custom mock with insufficient data                 | Research→Validator→Research→Validator→Synthesis       | Partial data with disclaimer   |
| 6   | Follow-up            | "What about their stock?" (after Apple)            | Inherits Apple context                                | Stock info for Apple           |
| 7   | Topic Change         | "Now tell me about Tesla" (after Apple)            | Updates company context                               | Tesla summary                  |
| 8   | Max Clarifications   | 3 vague queries                                    | 2 interrupts, then forced proceed                     | Best-guess response            |
| 9   | Empty Query          | ""                                                 | Clarification request                                 | "What would you like to know?" |
| 10  | Cancel Query         | "Nevermind"                                        | Skip to synthesis                                     | Friendly exit message          |

#### Data Source Specific Tests

| #   | Scenario               | Data Source     | Input                      | Expected Behavior                           |
| --- | ---------------------- | --------------- | -------------------------- | ------------------------------------------- |
| 11  | Mock - Known Company   | Mock            | "Tell me about Microsoft"  | Returns mock data with confidence 10        |
| 12  | Mock - Unknown Company | Mock            | "Tell me about RandomCorp" | Returns null findings, confidence 0         |
| 13  | Tavily - Real Query    | Tavily          | "Latest news about Apple"  | Returns real-time data (skip if no API key) |
| 14  | Tavily - API Error     | Tavily (mocked) | Force timeout              | Returns DataSourceError, handled gracefully |
| 15  | Source Auto-Detection  | Auto            | (no TAVILY_API_KEY)        | Falls back to Mock, logs warning            |

### 13.2 Test Implementation Example

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { buildResearchGraph } from "../src/graph";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

describe("Research Assistant Integration Tests", () => {
  let graph: ReturnType<typeof buildResearchGraph>;
  let threadId: string;
  let config: { configurable: { thread_id: string } };

  beforeEach(() => {
    graph = buildResearchGraph();
    threadId = crypto.randomUUID();
    config = { configurable: { thread_id: threadId } };
  });

  describe("Happy Path", () => {
    it("should return Apple summary for clear query", async () => {
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("What's happening with Apple?")],
          originalQuery: "What's happening with Apple?"
        },
        config
      );

      expect(result.finalSummary).toContain("Apple");
      expect(result.clarityStatus).toBe("clear");
      expect(result.detectedCompany).toBe("Apple Inc.");
      // No interrupt means __interrupt__ is undefined
      expect(result.__interrupt__).toBeUndefined();
    });
  });

  describe("Clarification Flow", () => {
    it("should interrupt for unclear query and resume correctly", async () => {
      // Initial unclear query
      const result1 = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about the company")],
          originalQuery: "Tell me about the company"
        },
        config
      );

      // Should be interrupted - check __interrupt__ array
      expect(result1.__interrupt__).toBeDefined();
      expect(result1.__interrupt__).toHaveLength(1);
      expect(result1.__interrupt__[0].value.question).toContain("company");

      // Resume with clarification using Command
      const result2 = await graph.invoke(
        new Command({ resume: "Apple" }),
        config // Same thread_id is crucial!
      );

      // Should complete successfully
      expect(result2.__interrupt__).toBeUndefined();
      expect(result2.finalSummary).toContain("Apple");
    });
  });

  describe("Retry Loop", () => {
    it("should retry research up to 3 times then proceed", async () => {
      // Use a company not in mock data to trigger low confidence
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("Tell me about Unknown Corp")],
          originalQuery: "Tell me about Unknown Corp"
        },
        config
      );

      // Should have attempted research multiple times
      expect(result.researchAttempts).toBeGreaterThan(1);
      expect(result.researchAttempts).toBeLessThanOrEqual(3);

      // Should still produce a summary (graceful degradation)
      expect(result.finalSummary).toBeDefined();
      expect(result.finalSummary).toContain("couldn't find");
    });
  });

  describe("Multi-turn Conversation", () => {
    it("should maintain context across turns", async () => {
      // Turn 1: Ask about Apple
      await graph.invoke(
        {
          messages: [new HumanMessage("What's happening with Apple?")],
          originalQuery: "What's happening with Apple?"
        },
        config
      );

      // Turn 2: Follow-up about stock (same thread_id!)
      const result = await graph.invoke(
        {
          messages: [new HumanMessage("What about their stock?")],
          originalQuery: "What about their stock?"
        },
        config
      );

      // Should still be about Apple (inherited from previous turn)
      expect(result.detectedCompany).toBe("Apple Inc.");
      expect(result.finalSummary).toMatch(/stock|trading|price/i);
    });
  });
});
```

### 13.3 Data Source Tests

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockDataSource } from "../src/data/mock-source";
import { TavilyDataSource } from "../src/data/tavily-source";
import { createDataSource } from "../src/data";

describe("MockDataSource", () => {
  let source: MockDataSource;

  beforeEach(() => {
    source = new MockDataSource();
  });

  it("should return data for known companies", async () => {
    const result = await source.search("Apple Inc.", {
      originalQuery: "Tell me about Apple",
      attemptNumber: 1
    });

    expect(result.findings).not.toBeNull();
    expect(result.findings?.company).toBe("Apple Inc.");
    expect(result.confidence).toBeGreaterThan(6);
    expect(result.source).toBe("Mock Data Source");
  });

  it("should normalize company names", async () => {
    const result = await source.search("apple", {
      originalQuery: "Tell me about apple",
      attemptNumber: 1
    });

    expect(result.findings?.company).toBe("Apple Inc.");
  });

  it("should return null for unknown companies", async () => {
    const result = await source.search("Unknown Corp", {
      originalQuery: "Tell me about Unknown Corp",
      attemptNumber: 1
    });

    expect(result.findings).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("should always report as available", () => {
    expect(source.isAvailable()).toBe(true);
  });
});

describe("TavilyDataSource", () => {
  // Skip these tests if no API key
  const shouldRun = !!process.env.TAVILY_API_KEY;

  it.skipIf(!shouldRun)("should search for real company data", async () => {
    const source = new TavilyDataSource();

    const result = await source.search("Apple Inc.", {
      originalQuery: "Latest Apple news",
      attemptNumber: 1
    });

    expect(result.findings).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.source).toBe("Tavily Search");
  });

  it("should report unavailable without API key", () => {
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const source = new TavilyDataSource();
    expect(source.isAvailable()).toBe(false);

    // Restore
    if (originalKey) process.env.TAVILY_API_KEY = originalKey;
  });
});

describe("createDataSource", () => {
  it("should create MockDataSource when type is 'mock'", () => {
    const source = createDataSource("mock");
    expect(source.getName()).toBe("Mock Data Source");
  });

  it("should fall back to mock when Tavily key is missing", () => {
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const source = createDataSource("auto");
    expect(source.getName()).toBe("Mock Data Source");

    if (originalKey) process.env.TAVILY_API_KEY = originalKey;
  });
});
```

---

## 14. Implementation Roadmap

### 14.1 Phase 1: Foundation (Day 1)

| Task | Description           | Output                                        |
| ---- | --------------------- | --------------------------------------------- |
| 1.1  | Project setup         | `package.json`, `tsconfig.json`, dependencies |
| 1.2  | State schema          | `src/graph/state.ts` with full annotation     |
| 1.3  | Data source interface | `src/data/data-source.interface.ts`           |
| 1.4  | Mock data source      | `src/data/mock-source.ts` with 5 companies    |
| 1.5  | Graph skeleton        | `src/graph/workflow.ts` with stub nodes       |
| 1.6  | Routers               | `src/graph/routers.ts` with all 4 functions   |
| 1.7  | Basic test            | Verify graph compiles and runs with stubs     |

**Milestone**: Graph visualizable, routing works with stub agents, mock data source functional.

### 14.2 Phase 2: Core Agents + Tavily (Day 2)

| Task | Description         | Output                                          |
| ---- | ------------------- | ----------------------------------------------- |
| 2.1  | Tavily data source  | `src/data/tavily-source.ts` with result parsing |
| 2.2  | Data source factory | `src/data/index.ts` with auto-detection         |
| 2.3  | Clarity Agent       | Full LLM-based query analysis                   |
| 2.4  | Research Agent      | Uses injected data source, confidence scoring   |
| 2.5  | Validator Agent     | Quality assessment with feedback                |
| 2.6  | Synthesis Agent     | Response generation with graceful degradation   |
| 2.7  | Unit tests          | Tests for each agent + both data sources        |

**Milestone**: All agents functional, both data sources working, passing unit tests.

### 14.3 Phase 3: Interrupt & Multi-turn (Day 3)

| Task | Description         | Output                                 |
| ---- | ------------------- | -------------------------------------- |
| 3.1  | Interrupt node      | Clarification interrupt implementation |
| 3.2  | Resume handling     | Client-side resume with Command        |
| 3.3  | Follow-up detection | Pattern-based follow-up handling       |
| 3.4  | Integration tests   | Full flow tests with interrupts        |
| 3.5  | Multi-turn tests    | Context preservation tests             |

**Milestone**: Interrupt flow working, multi-turn conversations functional.

### 14.4 Phase 4: Beyond Features (Day 4)

| Task | Description          | Output                               |
| ---- | -------------------- | ------------------------------------ |
| 4.1  | Streaming            | Agent progress + synthesis streaming |
| 4.2  | LangSmith            | Environment setup, documentation     |
| 4.3  | Graceful degradation | Error handling refinements           |
| 4.4  | Summarization        | Long conversation handling           |
| 4.5  | Polish               | Logging, error messages, edge cases  |

**Milestone**: All beyond features implemented and tested.

### 14.5 Phase 5: Documentation & Delivery (Day 5)

| Task | Description    | Output                               |
| ---- | -------------- | ------------------------------------ |
| 5.1  | README         | Complete setup and usage guide       |
| 5.2  | Assumptions    | Document all assumptions made        |
| 5.3  | Beyond section | Clear documentation of extras        |
| 5.4  | Example traces | 2+ conversation examples with output |
| 5.5  | Final testing  | End-to-end verification              |
| 5.6  | Package        | Zip repo for submission              |

**Milestone**: Ready for submission.

---

## 15. Appendices

### 15.1 Dependencies

```json
{
  "dependencies": {
    "@langchain/anthropic": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/tavily": "^0.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "dotenv": "^16.4.0"
  }
}
```

> **Note**: `@langchain/tavily` is the official Tavily integration. The older `@langchain/community` package also has Tavily tools but is deprecated in favor of the dedicated package.

### 15.2 Environment Variables

```bash
# .env.example

# ═══════════════════════════════════════════════════════════════════════════
# LLM CONFIGURATION (Required: one of these)
# ═══════════════════════════════════════════════════════════════════════════

ANTHROPIC_API_KEY=your_anthropic_key
# OR
OPENAI_API_KEY=your_openai_key

# ═══════════════════════════════════════════════════════════════════════════
# DATA SOURCE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

# Which data source to use: "mock" | "tavily" | "auto"
# - mock: Use built-in mock data (fast, no API key needed)
# - tavily: Use Tavily API (real-time data, requires TAVILY_API_KEY)
# - auto: Use Tavily if API key is set, otherwise mock
RESEARCH_DATA_SOURCE=auto

# Tavily API Key (required if RESEARCH_DATA_SOURCE=tavily)
# Get your key at: https://tavily.com/
TAVILY_API_KEY=tvly-your_tavily_key

# ═══════════════════════════════════════════════════════════════════════════
# OBSERVABILITY (Optional but recommended)
# ═══════════════════════════════════════════════════════════════════════════

# LangSmith tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=research-assistant

# ═══════════════════════════════════════════════════════════════════════════
# APPLICATION SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

# Log level: "debug" | "info" | "warn" | "error"
LOG_LEVEL=info

# Node environment
NODE_ENV=development
```

#### Environment Variable Reference

| Variable               | Required        | Default | Description                               |
| ---------------------- | --------------- | ------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY`    | Yes\*           | —       | Anthropic API key for Claude              |
| `OPENAI_API_KEY`       | Yes\*           | —       | OpenAI API key (alternative to Anthropic) |
| `RESEARCH_DATA_SOURCE` | No              | `auto`  | Data source selection                     |
| `TAVILY_API_KEY`       | If using Tavily | —       | Tavily search API key                     |
| `LANGCHAIN_TRACING_V2` | No              | `false` | Enable LangSmith tracing                  |
| `LANGCHAIN_API_KEY`    | If tracing      | —       | LangSmith API key                         |
| `LANGCHAIN_PROJECT`    | No              | —       | LangSmith project name                    |
| `LOG_LEVEL`            | No              | `info`  | Logging verbosity                         |

\*One LLM API key is required

### 15.3 Assumptions

1. **LLM Provider**: Anthropic Claude is preferred; OpenAI GPT-4 as fallback
2. **Confidence Scoring**: Scale of 0-10, threshold of 6 for skipping validation
3. **Max Attempts**: 3 research retries, 2 clarification attempts
4. **Data Sources**:
   - Mock: Apple, Tesla, Microsoft, Amazon, Google in mock dataset
   - Tavily: Real-time search with `@langchain/tavily` package
5. **Message Format**: Using LangChain message classes (HumanMessage, AIMessage)
6. **Checkpointer**: MemorySaver for development; PostgresSaver for production
7. **Streaming**: Console-based output; adaptable to web sockets
8. **Testing**: Vitest as test runner; mock data source for unit tests, Tavily tests skipped without API key
9. **Data Source Selection**: Environment variable `RESEARCH_DATA_SOURCE` controls which source is used
10. **Tavily Fallback**: If Tavily fails, error is handled gracefully (no automatic fallback to mock to maintain data source integrity)

### 15.4 Glossary

| Term             | Definition                                                            |
| ---------------- | --------------------------------------------------------------------- |
| **Agent**        | A node in the graph that performs a specific task using LLM reasoning |
| **Checkpointer** | Persistence layer that saves state between invocations                |
| **Interrupt**    | Mechanism to pause graph execution and await external input           |
| **Reducer**      | Function that determines how state updates are applied                |
| **Router**       | Function that determines the next node based on current state         |
| **Superstep**    | One iteration of the graph execution loop                             |
| **Thread**       | A unique conversation session identified by thread_id                 |

---

## Document History

| Version | Date     | Author    | Changes                                                                                                                                                                                                                                                 |
| ------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | Dec 2024 | Architect | Initial comprehensive design                                                                                                                                                                                                                            |
| 1.1.0   | Dec 2024 | Architect | Review fixes: removed incorrect `interruptBefore` usage, added node restart behavior documentation, clarified clarification attempts logic, fixed test syntax errors, added state reset implementation guidance, added idempotency requirements section |
| 1.2.0   | Dec 2024 | Architect | Added full Tavily integration as core feature: data source interface, TavilyDataSource implementation, MockDataSource with 5 companies, factory pattern for source selection, environment configuration                                                 |

---

_End of Architecture Document_
