# Research Assistant

A multi-agent research assistant built with LangGraph TypeScript.

## Quick Start

```bash
# Install dependencies
npm install

# Configure (copy and edit)
cp .env.example .env

# Run
npm start
```

## Features

- **4-agent orchestrated workflow** - Clarity, Research, Validator, and Synthesis agents
- **Human-in-the-loop clarification** - Interrupts for ambiguous queries
- **Multi-turn conversation** - Maintains context across queries
- **Mock + Tavily data sources** - Works offline or with real-time search
- **Streaming progress updates** - Real-time feedback during execution
- **Validation retry loop** - Automatically retries research if quality is insufficient
- **Graph visualization** - Generate Mermaid diagrams of the workflow
- **Error recovery** - Graceful error handling with user-friendly messages
- **Request tracking** - Correlation IDs for tracing requests across the graph
- **Timeout protection** - Configurable timeouts prevent hanging operations
- **Input validation** - Validates and sanitizes user queries
- **Message summarization** - Automatically summarizes long conversation history
- **Token budget management** - Prevents token limit errors across all agents

## Configuration

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

## Architecture

The workflow follows this structure:

```
START -> clarity -> [interrupt OR research OR error-recovery]
                         |
         interrupt -> clarity (loop back)
         research -> [validator OR synthesis OR error-recovery]
                         |
         validator -> [research (retry) OR synthesis OR error-recovery]
         synthesis -> END
         error-recovery -> END
```

### Key Improvements

- **Error Recovery**: All agents are wrapped with error handling that routes to a dedicated error-recovery agent
- **Request Tracking**: Correlation IDs are generated per query and included in all log entries
- **Timeout Protection**: Graph execution is wrapped with configurable timeouts
- **Input Validation**: Queries are validated for length and content before processing
- **Message Summarization**: Long conversations are automatically summarized to stay within token limits
- **Token Budget**: All agents use token budget management to prevent token limit errors

See [docs/ARCHITECTURE-DESIGN.md](docs/ARCHITECTURE-DESIGN.md) for detailed design documentation.

See [docs/IMPROVEMENT-PLAN.md](docs/IMPROVEMENT-PLAN.md) for the comprehensive improvement roadmap.

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

## Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm test -- clarity.test    # Specific test file
npm run generate-diagram    # Generate workflow diagram
```

### Test Categories

- `tests/graph/` - State and router unit tests
- `tests/agents/` - Agent unit tests with mock LLMs
- `tests/data/` - Data source tests
- `tests/integration/` - End-to-end workflow tests (including error scenarios)
- `tests/utils/` - Utility function tests (logging, timeout, validation, etc.)

## Example Conversations

### Clear Query

```
You: What's happening with Apple?

📊 Assistant:
Here's what I found about Apple Inc...
```

### Clarification Flow

```
You: Tell me about the company

🤔 Which company are you asking about?

You: Tesla

📊 Assistant:
Here's what I found about Tesla...
```

## CLI Commands

- Type your query and press Enter
- Type `quit` to exit
- Type `new` to start a new conversation thread

## Beyond Expected Deliverable

1. **Streaming Progress**: Real-time agent status indicators during execution
2. **Tavily Integration**: Production-ready web search, not just mock data
3. **LangSmith Tracing**: Built-in observability support for debugging
4. **Graceful Degradation**: Confidence-based prefixes, fallback templates when LLM fails
5. **Data Source Abstraction**: Factory pattern allows swapping mock/Tavily without code changes
6. **Comprehensive Tests**: 14 test files covering unit, agent, and integration scenarios
7. **Dependency Injection**: All agents accept injectable LLM/data sources for testing
8. **Token Budget Management**: Intelligent context selection based on token limits instead of arbitrary message slicing
9. **Execution Metrics**: Track node execution times, retry counts, and workflow duration for observability
10. **Graph Visualization**: Generate Mermaid diagrams with `npm run generate-diagram`

## License

MIT
