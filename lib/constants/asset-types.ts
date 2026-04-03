/**
 * Common asset type labels (reference / placeholders only). Category is free text in forms and imports.
 * Spec keys are optional hints for type-specific specs (e.g. Laptop: company, ram).
 * Actual specs are stored in assets.specs JSONB; keys can vary per asset.
 */
export const ASSET_TYPE_OPTIONS = [
  "Laptop",
  "Mobile",
  "GPS",
  "Inverter",
  "Scanner",
  "Spectrum Analyzer",
  "R&S Scanner",
  "Data Cable",
  "Other",
] as const;

export type AssetTypeOption = (typeof ASSET_TYPE_OPTIONS)[number];

/** Suggested spec keys by type (for form placeholders / optional validation) */
export const ASSET_SPEC_HINTS: Partial<Record<AssetTypeOption, string[]>> = {
  Laptop: ["company", "ram", "serial"],
  Inverter: ["company", "serial"],
  "Spectrum Analyzer": ["company", "serial"],
  "R&S Scanner": ["company", "serial"],
};
