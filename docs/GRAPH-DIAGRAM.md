# Research Assistant Graph

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}}}%%
graph TD;
	__start__([<p>__start__</p>]):::first
	clarity(clarity)
	interrupt(interrupt)
	research(research)
	validator(validator)
	synthesis(synthesis)
	error-recovery(error-recovery)
	__end__([<p>__end__</p>]):::last
	__start__ --> clarity;
	error-recovery --> __end__;
	interrupt --> clarity;
	synthesis --> __end__;
	clarity -.-> interrupt;
	clarity -.-> research;
	clarity -.-> error-recovery;
	research -.-> validator;
	research -.-> synthesis;
	research -.-> error-recovery;
	validator -.-> research;
	validator -.-> synthesis;
	validator -.-> error-recovery;
	classDef default fill:#f2f0ff,line-height:1.2;
	classDef first fill-opacity:0;
	classDef last fill:#bfb6fc;

```

## Node Descriptions

- **clarity**: Analyzes query and detects company name
- **interrupt**: Pauses for user clarification when needed
- **research**: Fetches data from Tavily or mock sources
- **validator**: Checks if research findings are sufficient
- **synthesis**: Generates final user-facing summary
