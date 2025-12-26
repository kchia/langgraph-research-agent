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

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Claude API key for LLM features |
| `RESEARCH_DATA_SOURCE` | No | `auto` | `mock`, `tavily`, or `auto` |
| `TAVILY_API_KEY` | If tavily | - | Tavily search API key |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` |
| `LANGCHAIN_TRACING_V2` | No | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | If tracing | - | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | `research-assistant` | LangSmith project name |

## Architecture

The workflow follows this structure:

```
START -> clarity -> [interrupt OR research]
                         |
         interrupt -> clarity (loop back)
         research -> [validator OR synthesis]
                         |
         validator -> [research (retry) OR synthesis]
         synthesis -> END
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design documentation.

## Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm test -- clarity.test    # Specific test file
```

### Test Categories

- `tests/graph/` - State and router unit tests
- `tests/agents/` - Agent unit tests with mock LLMs
- `tests/data/` - Data source tests
- `tests/integration/` - End-to-end workflow tests

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

## License

MIT
