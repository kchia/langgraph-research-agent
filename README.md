# Research Assistant

A multi-agent research assistant built with LangGraph TypeScript.

## Features

- **6 Specialized Agents**: Clarity, Research, Validator, Synthesis, Interrupt, Error Recovery
- **Multi-turn Conversations**: Context persists across queries; follow-up questions supported
- **Human-in-the-Loop**: Automatic clarification requests for ambiguous queries
- **Dual Data Sources**: Mock data for testing, Tavily API for production
- **Graceful Error Recovery**: User-friendly messages instead of crashes
- **Confidence-Based Routing**: High-confidence results skip validation for speed

## Prerequisites

- Node.js 20+
- npm 9+
- Anthropic API key ([get one here](https://console.anthropic.com/))
- (Optional) Tavily API key for real-time search

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Then edit `.env` and add your API keys:
```
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...
```

### 3. Run the application
```bash
npm start
```

### 4. Try a query
Once running, type a company research query:
```
> What does Tesla do?
```

## CLI Commands

- Type your query and press Enter
- Type `quit` to exit
- Type `new` to start a new conversation thread

## Env Configuration

| Variable                   | Required   | Default              | Description                             |
| -------------------------- | ---------- | -------------------- | --------------------------------------- |
| `ANTHROPIC_API_KEY`        | Yes        | -                    | Claude API key for LLM features         |
| `RESEARCH_DATA_SOURCE`     | No         | `auto`               | `mock`, `tavily`, or `auto`             |
| `TAVILY_API_KEY`           | If tavily  | -                    | Tavily search API key                   |
| `LOG_LEVEL`                | No         | `info`               | `debug`, `info`, `warn`, `error`        |
| `LANGCHAIN_TRACING_V2`     | No         | `false`              | Enable LangSmith tracing                |
| `LANGCHAIN_API_KEY`        | If tracing | -                    | LangSmith API key                       |
| `LANGCHAIN_PROJECT`        | No         | `research-assistant` | LangSmith project name                  |
| `GRAPH_TIMEOUT_MS`         | No         | `300000`             | Graph execution timeout (5 min default) |
| `CHECKPOINTER_TYPE`        | No         | `memory`             | `memory` or `sqlite`                    |
| `CHECKPOINTER_SQLITE_PATH` | If sqlite  | -                    | Path to SQLite checkpoint DB            |

## Project Structure

```
src/
├── agents/          # 6 specialized agents
│   ├── clarity.agent.ts
│   ├── research.agent.ts
│   ├── validator.agent.ts
│   ├── synthesis.agent.ts
│   ├── interrupt.agent.ts
│   └── error-recovery.agent.ts
├── graph/           # LangGraph workflow
│   ├── state.ts     # State schema (15+ fields)
│   ├── workflow.ts  # Graph construction
│   ├── routers.ts   # Conditional routing
│   └── routes.ts    # Agent name constants
├── sources/         # Data sources
│   ├── tavily-source.ts
│   ├── mock-source.ts
│   └── mock-data.ts
├── prompts/         # LLM prompt templates
├── utils/           # Shared utilities
└── index.ts         # CLI entry point
```

## Architecture

The workflow follows this structure:

![Research Assistant Graph](./docs/GRAPH-DIAGRAM.md)

## Assumptions

1. **Company Scope**: Focus on publicly traded companies. Name normalization maps common names to legal names (e.g., "Apple" → "Apple Inc.").

2. **Data Freshness**: Mock data is a static snapshot. Use Tavily for real-time data.

3. **Clarification Limit**: Maximum 2 clarification attempts before proceeding gracefully.

4. **Confidence Threshold**: Score ≥6 bypasses validation. Balances thoroughness with speed.

5. **Retry Limit**: Maximum 3 research attempts prevents infinite loops.

6. **LLM Dependency**: Claude (Anthropic) required. System degrades gracefully on LLM failures.

7. **Error Handling**: All agents have error recovery with user-friendly messages. Errors are logged with correlation IDs for debugging.

8. **Timeout Protection**: Graph execution has a default 5-minute timeout (configurable via `GRAPH_TIMEOUT_MS`).

9. **State Persistence**: Company names and conversation context persist across queries for natural multi-turn conversations.

## Engineering Practices

- **Type Safety**: Zod schemas for config, inputs, and LLM outputs; TypeScript strict mode
- **Error Handling**: Higher-order wrapper pattern; structured errors with `isRetryable`/`statusCode`; graceful fallbacks
- **Retry Logic**: Intelligent classification (HTTP codes → Node.js codes → message matching); exponential backoff via p-retry
- **Observability**: Correlation IDs across all agents; extensible log transports; structured logging
- **Token Management**: tiktoken-based counting; sentence-boundary truncation; message summarization for long conversations
- **Performance**: LLM instance caching; configurable timeouts (default 5 min); token budgets per agent
- **Testability**: Factory functions with optional LLM injection; hoisted mocks; 60s test timeouts for LLM calls

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed documentation.

## Testing

```bash
npm test                    # Run all tests
npm run generate-diagram    # Generate workflow diagram
```

### Test Categories

- `tests/graph/` - State and router unit tests
- `tests/agents/` - Agent unit tests with mock LLMs
- `tests/data/` - Data source tests
- `tests/integration/` - End-to-end workflow tests (including error scenarios)
- `tests/utils/` - Utility function tests (logging, timeout, validation, etc.)

## Example Conversations

For complete conversation logs with detailed output, see:

- [Clear company query with follow-ups](docs/example-conversation-clear-company-name.txt) - Tesla research + competitors + acquisitions
- [Unclear query with clarification](docs/example-conversation-unclear-company-name.txt) - Ambiguous input → clarification → graceful handling
- [Validation retry loop](docs/example-validation-retry.txt) - Low confidence → Validator insufficient → Retry with feedback → Success
- [Max clarification attempts](docs/example-conversation-max-clarifications.txt) - 2 unclear inputs → Graceful fallback

## Beyond Expected Deliverable

This implementation exceeds the base requirements with the following additions:

### Additional Agent

- **Error Recovery Agent**: A 6th agent that catches unhandled exceptions from any node and generates context-aware, user-friendly error messages instead of crashing.

### Production Data Source

- **Tavily Integration**: Real-time search API (`src/sources/tavily-source.ts`) with topic detection, structured output parsing, and automatic fallback to mock data when API key is unavailable.

### Robustness

- **Intelligent Retry Logic**: Exponential backoff with smart error classification (HTTP status → Node.js error codes → message matching) via p-retry.
- **Timeout Protection**: Configurable graph execution timeout (default 5 min) prevents hanging operations.
- **Graceful Fallbacks**: Validators fall back to rule-based logic when LLM fails; agents return partial data rather than crashing.

### Observability

- **Correlation ID Tracing**: Unique ID per request propagated through all agents for end-to-end debugging.
- **Extensible Logging**: Pluggable transport interface for CloudWatch, Datadog, or custom backends.
- **LangSmith Integration**: Optional tracing for debugging agent behavior.

### Token Management

- **tiktoken-based Counting**: Accurate token estimation.
- **Sentence-Boundary Truncation**: Intelligent truncation that preserves readability.
- **Message Summarization**: Automatic summarization of long conversations (>8000 tokens) to stay within context limits.

### Performance

- **LLM Instance Caching**: Reuses model instances per agent type.
- **Token Budgets**: Per-agent limits prevent context overflow (validator: 6k, synthesis: 8k, clarity: 4k).

### Documentation

- **Architecture Documentation**: Detailed `docs/ARCHITECTURE.md` with Mermaid diagrams, state schema visualization, and routing logic explanations.

### Testing

- **Comprehensive Test Suite**: Unit tests for agents, routers, and utilities; integration tests for full workflow including error scenarios.
- **Dependency Injection**: Factory pattern enables mock LLM injection for deterministic testing.

## Limitations & Future Work

### Currently Unsupported Use Cases

| Use Case                     | Current Behavior                      | What Would Be Needed                                                                  |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| **Compare two companies**    | Only researches one company per query | Multi-entity state tracking, parallel research subgraphs, comparison synthesis prompt |
| **Historical analysis**      | Returns current snapshot only         | Time-series data source, date range parameters, trend analysis agent                  |
| **Industry/sector research** | Requires specific company name        | Sector classification, company discovery agent, aggregation logic                     |
| **Financial deep-dives**     | Surface-level metrics only            | SEC filings integration, financial modeling agent, ratio analysis                     |
| **Real-time monitoring**     | One-shot queries only                 | Streaming architecture, webhook support, alerting system                              |

### Architectural Enhancements for Scale

- **Parallel Subgraphs**: For multi-company queries, spawn parallel research subgraphs and merge results
- **Caching Layer**: Redis/Memcached for repeated queries; invalidation based on data freshness
- **RAG Integration**: Vector store for company filings, earnings calls, news archives
- **Agent Specialization**: Dedicated agents for financials, products, leadership, competitors
- **Streaming Responses**: Token-by-token output for better UX on long syntheses
