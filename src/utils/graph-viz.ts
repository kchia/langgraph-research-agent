import { MemorySaver } from "@langchain/langgraph";
import { writeFileSync } from "fs";
import { Logger } from "./logger.js";
import { compileResearchGraph } from "../graph/workflow.js";

const logger = new Logger("graph-viz");

/**
 * Generate a Mermaid diagram from the research workflow.
 * Returns the raw Mermaid diagram string.
 */
export function generateMermaidDiagram(): string {
  try {
    // Use a temporary memory saver for diagram generation
    const graph = compileResearchGraph(new MemorySaver());
    return graph.getGraph().drawMermaid();
  } catch (error) {
    logger.error("Failed to generate Mermaid diagram", {
      error: String(error)
    });
    return "graph TD\n  Error[Failed to generate diagram]";
  }
}

/**
 * Save the Mermaid diagram to a markdown file.
 *
 * @param filepath - Path to save the markdown file
 */
export function saveMermaidDiagram(filepath: string): void {
  const diagram = generateMermaidDiagram();
  const content = `# Research Assistant Graph

\`\`\`mermaid
${diagram}
\`\`\`

## Node Descriptions

- **clarity**: Analyzes query and detects company name
- **interrupt**: Pauses for user clarification when needed
- **research**: Fetches data from Tavily or mock sources
- **validator**: Checks if research findings are sufficient
- **synthesis**: Generates final user-facing summary
`;
  writeFileSync(filepath, content);
  logger.info("Mermaid diagram saved", { filepath });
}
