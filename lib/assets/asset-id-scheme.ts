/**
 * Auto-generated asset_id rules (prefix + numeric suffix).
 * Laptops / mobiles: {CompanySlug}-ASTL|ASTM-{code}
 * Other types: {PREFIX}-{code}
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AssetIdScheme =
  | { kind: "company_middle"; middle: "ASTL" | "ASTM"; start: number }
  | { kind: "prefix"; prefix: string; start: number };

/** Normalize company string for ID segment (matches historical "COMPANY-ASTL-1001"). */
export function slugCompany(company: string): string {
  return company
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

const EXACT_CATEGORY_SCHEME: Record<string, AssetIdScheme> = {
  laptop: { kind: "company_middle", middle: "ASTL", start: 1001 },
  laptops: { kind: "company_middle", middle: "ASTL", start: 1001 },
  mobile: { kind: "company_middle", middle: "ASTM", start: 2001 },
  mobiles: { kind: "company_middle", middle: "ASTM", start: 2001 },
  gps: { kind: "prefix", prefix: "ASTG", start: 3001 },
  inverter: { kind: "prefix", prefix: "ASTI", start: 4001 },
  "data cable": { kind: "prefix", prefix: "ASTC", start: 5001 },
  datacable: { kind: "prefix", prefix: "ASTC", start: 5001 },
  charger: { kind: "prefix", prefix: "ASTCH", start: 6001 },
  dongle: { kind: "prefix", prefix: "ASTD", start: 7001 },
  router: { kind: "prefix", prefix: "ASTR", start: 8001 },
  "power bank": { kind: "prefix", prefix: "ASTPB", start: 9001 },
  powerbank: { kind: "prefix", prefix: "ASTPB", start: 9001 },
  "usb hub": { kind: "prefix", prefix: "ASTU", start: 12001 },
  usbhub: { kind: "prefix", prefix: "ASTU", start: 12001 },
  "aramco mobile device": { kind: "prefix", prefix: "ARAMD", start: 11001 },
  "aramco digital": { kind: "prefix", prefix: "ARAD", start: 10001 },
  "aramco digital/device": { kind: "prefix", prefix: "ARAD", start: 10001 },
};

export function resolveAssetIdScheme(category: string): AssetIdScheme | null {
  const k = category.trim().toLowerCase().replace(/\s+/g, " ");
  if (EXACT_CATEGORY_SCHEME[k]) return EXACT_CATEGORY_SCHEME[k];

  const compact = k.replace(/\s+/g, "");
  if (EXACT_CATEGORY_SCHEME[compact]) return EXACT_CATEGORY_SCHEME[compact];

  if (k.includes("aramco") && (k.includes("mobile") || compact.includes("aramd"))) {
    return { kind: "prefix", prefix: "ARAMD", start: 11001 };
  }
  if (k.includes("aramco") || k.includes("arad")) {
    return { kind: "prefix", prefix: "ARAD", start: 10001 };
  }

  return null;
}

function maxForCompanyMiddle(assetIds: (string | null)[], middle: "ASTL" | "ASTM", companySlug: string): number {
  const re = new RegExp(`^(.+)-${middle}-(\\d+)$`, "i");
  let max = 0;
  for (const raw of assetIds) {
    if (!raw || typeof raw !== "string") continue;
    const id = raw.trim();
    const m = id.match(re);
    if (!m) continue;
    if (slugCompany(m[1]) !== companySlug) continue;
    const n = parseInt(m[2], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

function maxForPrefix(assetIds: (string | null)[], prefix: string): number {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}-?(\\d+)$`, "i");
  let max = 0;
  for (const raw of assetIds) {
    if (!raw || typeof raw !== "string") continue;
    const m = raw.trim().match(re);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

export function formatNextAssetId(scheme: AssetIdScheme, company: string, nextNum: number): string {
  if (scheme.kind === "company_middle") {
    const slug = slugCompany(company);
    return `${slug}-${scheme.middle}-${nextNum}`;
  }
  return `${scheme.prefix}-${nextNum}`;
}

/**
 * Next asset_id for a new row: scans existing assets with the same category (case-insensitive).
 */
export async function computeNextAssetId(
  supabase: SupabaseClient,
  category: string,
  company: string
): Promise<string | null> {
  const scheme = resolveAssetIdScheme(category);
  if (!scheme) return null;

  if (scheme.kind === "company_middle") {
    const slug = slugCompany(company);
    if (!slug) return null;
  }

  const cat = category.trim();
  const { data: rows, error } = await supabase.from("assets").select("asset_id").ilike("category", cat);
  if (error) return null;

  const ids = (rows ?? []).map((r) => r.asset_id as string | null);

  let nextNum: number;
  if (scheme.kind === "company_middle") {
    const slug = slugCompany(company);
    if (!slug) return null;
    const max = maxForCompanyMiddle(ids, scheme.middle, slug);
    nextNum = max > 0 ? max + 1 : scheme.start;
  } else {
    const max = maxForPrefix(ids, scheme.prefix);
    nextNum = max > 0 ? max + 1 : scheme.start;
  }

  return formatNextAssetId(scheme, company, nextNum);
}

export function categoryGroupsByCompany(category: string): boolean {
  const k = category.trim().toLowerCase();
  return k === "laptop" || k === "laptops" || k === "mobile" || k === "mobiles";
}

export function companyFromAssetRow(specs: unknown, name: string | null): string {
  if (specs && typeof specs === "object" && !Array.isArray(specs)) {
    const c = (specs as Record<string, unknown>).company;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return (name ?? "").trim() || "—";
}
