import type { ResearchFindings } from "../graph/state.js";

/**
 * Options for formatting research findings.
 */
export interface FormatFindingsOptions {
  /** Include company name in output (default: false) */
  includeCompany?: boolean;
  /** Include sources list in output (default: false) */
  includeSources?: boolean;
  /** Label for stock info field (default: "Stock Info") */
  stockLabel?: string;
}

/**
 * Format research findings into a human-readable string.
 *
 * Used by validator and synthesis agents to prepare findings for LLM prompts.
 *
 * @param findings - The research findings to format
 * @param options - Formatting options
 * @returns Formatted string representation of findings
 */
export function formatFindings(
  findings: ResearchFindings | null,
  options: FormatFindingsOptions = {}
): string {
  if (!findings) return "No findings";

  const {
    includeCompany = false,
    includeSources = false,
    stockLabel = "Stock Info"
  } = options;

  const lines: string[] = [];

  if (includeCompany) {
    lines.push(`Company: ${findings.company}`);
  }

  lines.push(`Recent News: ${findings.recentNews ?? "Not available"}`);
  lines.push(`${stockLabel}: ${findings.stockInfo ?? "Not available"}`);
  lines.push(
    `Key Developments: ${findings.keyDevelopments ?? "Not available"}`
  );

  if (includeSources) {
    lines.push(`Sources: ${findings.sources.join(", ") || "None"}`);
  }

  return lines.join("\n");
}

/**
 * Format findings for display to users (with markdown formatting).
 *
 * Used by error-recovery and synthesis fallback for user-facing output.
 *
 * @param findings - The research findings to format
 * @returns Markdown-formatted string for user display
 */
export function formatFindingsForDisplay(
  findings: ResearchFindings | null
): string {
  if (!findings) return "";

  const parts: string[] = [`Here's what I found about ${findings.company}:`];

  if (findings.recentNews) {
    parts.push(`\n**Recent News**: ${findings.recentNews}`);
  }
  if (findings.stockInfo) {
    parts.push(`\n**Financial**: ${findings.stockInfo}`);
  }
  if (findings.keyDevelopments) {
    parts.push(`\n**Key Developments**: ${findings.keyDevelopments}`);
  }

  return parts.join("\n");
}

/**
 * Append findings summary to a message string (for error recovery).
 *
 * @param message - Base message to append to
 * @param findings - Research findings to append
 * @param includeKeyDevelopments - Whether to include key developments
 * @returns Message with findings appended
 */
export function appendFindingsToMessage(
  message: string,
  findings: ResearchFindings | null,
  includeKeyDevelopments = false
): string {
  if (!findings) return message;

  let result = message;
  result += `\n\n**${findings.company}**:\n`;

  if (findings.recentNews) {
    result += `Recent News: ${findings.recentNews}\n`;
  }
  if (findings.stockInfo) {
    result += `Stock Info: ${findings.stockInfo}\n`;
  }
  if (includeKeyDevelopments && findings.keyDevelopments) {
    result += `Key Developments: ${findings.keyDevelopments}\n`;
  }

  return result;
}
