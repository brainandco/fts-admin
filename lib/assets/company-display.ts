/**
 * Consistent company / brand labels: merge DELL and Dell, show readable casing (Dell, Lenovo, HP).
 */

/** Known tokens → canonical display (acronyms and Apple-style names). */
const WORD_DISPLAY: Record<string, string> = {
  hp: "HP",
  lg: "LG",
  ibm: "IBM",
  htc: "HTC",
  msi: "MSI",
  amd: "AMD",
  iphone: "iPhone",
  ipad: "iPad",
  macbook: "MacBook",
  imac: "iMac",
  ipod: "iPod",
};

const SPLIT_RE = /(\s+|-|\/)/;

function formatOneToken(token: string): string {
  if (!token) return token;
  const lower = token.toLowerCase();
  if (WORD_DISPLAY[lower]) return WORD_DISPLAY[lower];
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Raw company string from DB (before formatting).
 */
export function rawCompanyFromAsset(specs: unknown, name: string | null | undefined): string {
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    const c = (specs as Record<string, unknown>).company;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return (name ?? "").trim();
}

/**
 * Stable lowercase key for grouping (DELL, Dell, dell → same bucket).
 */
export function companyGroupingKey(rawOrFormatted: string): string {
  const t = rawOrFormatted.trim().toLowerCase().replace(/\s+/g, " ");
  return t || "—";
}

/**
 * Display label: first letter uppercase per word, known acronyms (HP), Apple-style (iPhone).
 */
export function formatCompanyDisplayName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const parts = trimmed.split(SPLIT_RE);
  const out: string[] = [];
  for (const part of parts) {
    if (part === " " || part === "-" || part === "/" || part === "") {
      out.push(part);
      continue;
    }
    out.push(formatOneToken(part));
  }
  return out.join("");
}

/**
 * Formatted company for tables and cards, or "—" if missing.
 */
export function companyDisplayFromAsset(specs: unknown, name: string | null | undefined): string {
  const raw = rawCompanyFromAsset(specs, name);
  if (!raw) return "—";
  return formatCompanyDisplayName(raw) || "—";
}

/** DOM id for company section anchors (must match {@link AssetCategoryTables} sections). */
export function companySectionAnchorId(groupKey: string): string {
  const slug = groupKey.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other";
  return `company-${slug}`;
}
