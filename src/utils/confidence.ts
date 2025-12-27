import {
  CONFIDENCE_HIGH_THRESHOLD,
  CONFIDENCE_MEDIUM_THRESHOLD
} from "./constants.js";

/**
 * Confidence level for research findings.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Determine confidence level based on a numeric score.
 *
 * Uses thresholds from constants:
 * - High: score >= CONFIDENCE_HIGH_THRESHOLD (8)
 * - Medium: score >= CONFIDENCE_MEDIUM_THRESHOLD (5)
 * - Low: score < CONFIDENCE_MEDIUM_THRESHOLD
 *
 * @param score - Confidence score (0-10 scale)
 * @returns Confidence level string
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_HIGH_THRESHOLD) return "high";
  if (score >= CONFIDENCE_MEDIUM_THRESHOLD) return "medium";
  return "low";
}
