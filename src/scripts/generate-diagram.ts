#!/usr/bin/env node
/**
 * Script to generate a Mermaid diagram of the research workflow.
 *
 * Usage: npx tsx src/scripts/generate-diagram.ts
 */

import { saveMermaidDiagram } from "../utils/graph-viz.js";

const outputPath = "./docs/GRAPH-DIAGRAM.md";

try {
  saveMermaidDiagram(outputPath);
  console.log(`Graph diagram generated at ${outputPath}`);
} catch (error) {
  console.error("Failed to generate diagram:", error);
  process.exit(1);
}
