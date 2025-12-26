/**
 * Company name normalization configuration and utilities.
 *
 * This module provides configurable company name normalization
 * to map common variations to standardized company names.
 */

/**
 * Default company name mapping.
 * Maps common variations (lowercase keys) to standardized company names.
 */
export const DEFAULT_COMPANY_MAP: Record<string, string> = {
  apple: "Apple Inc.",
  tesla: "Tesla, Inc.",
  microsoft: "Microsoft Corporation",
  amazon: "Amazon.com, Inc.",
  google: "Alphabet Inc.",
  alphabet: "Alphabet Inc.",
  meta: "Meta Platforms, Inc.",
  facebook: "Meta Platforms, Inc.",
  nvidia: "NVIDIA Corporation",
  netflix: "Netflix, Inc."
};

/**
 * Common company suffixes that indicate a properly formatted name.
 */
export const COMPANY_SUFFIXES = [
  "Inc.",
  "Corporation",
  "Corp.",
  "LLC",
  "Ltd.",
  "Limited",
  "Company",
  "Co."
];

/**
 * Interface for company normalization configuration.
 */
export interface CompanyNormalizationConfig {
  /**
   * Mapping of lowercase company name variations to standardized names.
   */
  companyMap: Record<string, string>;

  /**
   * List of suffixes that indicate a properly formatted company name.
   */
  suffixes: string[];
}

/**
 * Default normalization configuration.
 */
export const DEFAULT_NORMALIZATION_CONFIG: CompanyNormalizationConfig = {
  companyMap: DEFAULT_COMPANY_MAP,
  suffixes: COMPANY_SUFFIXES
};

/**
 * Normalize a company name using the provided configuration.
 *
 * @param company - Company name to normalize (can be null)
 * @param config - Normalization configuration (uses default if not provided)
 * @returns Normalized company name or null
 */
export function normalizeCompanyName(
  company: string | null,
  config: CompanyNormalizationConfig = DEFAULT_NORMALIZATION_CONFIG
): string | null {
  if (!company) return null;

  const normalized = company.trim();
  const lower = normalized.toLowerCase();

  // Check exact match first
  if (config.companyMap[lower]) {
    return config.companyMap[lower];
  }

  // Check if the normalized name already contains common suffixes
  const hasSuffix = config.suffixes.some((suffix) =>
    normalized.includes(suffix)
  );
  if (hasSuffix) {
    return normalized;
  }

  // Check partial matches (e.g., "Apple Inc" -> "Apple Inc.")
  for (const [key, value] of Object.entries(config.companyMap)) {
    if (lower.startsWith(key + " ") || lower.endsWith(" " + key)) {
      return value;
    }
  }

  // Return as-is if no normalization found
  return normalized;
}

/**
 * Create a custom normalization configuration by merging with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete normalization configuration
 */
export function createNormalizationConfig(
  overrides: Partial<CompanyNormalizationConfig>
): CompanyNormalizationConfig {
  return {
    companyMap: {
      ...DEFAULT_COMPANY_MAP,
      ...overrides.companyMap
    },
    suffixes: overrides.suffixes ?? COMPANY_SUFFIXES
  };
}
