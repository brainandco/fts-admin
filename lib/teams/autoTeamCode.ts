import type { SupabaseClient } from "@supabase/supabase-js";
import { TEAM_CODE_MAX_LEN, isValidTeamCodeFormat } from "@/lib/teams/teamCode";

/** Max length of the geographic segment between TEAM- and the numeric suffix. */
const MAX_SLUG_LEN = 18;

/**
 * Derives a stable uppercase slug from a region display name (e.g. "East" → "EAST", "East Coast" → "EAST-COAST").
 */
export function regionNameToCodeSlug(name: string): string {
  const raw = name.trim().replace(/\s+/g, " ");
  const parts = raw.split(/[\s/,-]+/).filter(Boolean);
  let slug = parts
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join("-")
    .toUpperCase();
  if (!slug) slug = "REGION";
  if (slug.length > MAX_SLUG_LEN) {
    slug = slug.slice(0, MAX_SLUG_LEN).replace(/-+$/, "");
  }
  return slug;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatSequenceNum(n: number): string {
  return n < 100 ? String(n).padStart(2, "0") : String(n);
}

/**
 * Builds TEAM-{SLUG}-{NN} within TEAM_CODE_MAX_LEN by shortening the slug if needed.
 */
export function buildAutoTeamCode(slug: string, sequence: number): string {
  const num = formatSequenceNum(sequence);
  let s = slug;
  for (;;) {
    const candidate = `TEAM-${s}-${num}`;
    if (candidate.length <= TEAM_CODE_MAX_LEN) return candidate.toUpperCase();
    if (s.length <= 1) {
      const fallback = `TEAM-${num}`.slice(0, TEAM_CODE_MAX_LEN);
      return fallback.toUpperCase();
    }
    s = s.slice(0, -1).replace(/-+$/, "");
  }
}

/**
 * Next code for a region: max(team count + 1, max existing TEAM-{slug}-N + 1).
 */
export async function computeNextTeamCodeForRegion(
  supabase: SupabaseClient,
  regionId: string,
  regionName: string
): Promise<{ code: string; slug: string; sequence: number }> {
  const slug = regionNameToCodeSlug(regionName);

  const { count: teamCountRaw } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("region_id", regionId);
  const teamCount = teamCountRaw ?? 0;

  const { data: codeRows } = await supabase.from("teams").select("team_code").eq("region_id", regionId);

  let maxParsed = 0;
  const re = new RegExp(`^TEAM-${escapeRegExp(slug)}-(\\d+)$`, "i");
  for (const row of codeRows ?? []) {
    const tc = String(row.team_code ?? "").trim().toUpperCase();
    const m = tc.match(re);
    if (m) maxParsed = Math.max(maxParsed, parseInt(m[1], 10));
  }

  const sequence = Math.max(teamCount + 1, maxParsed + 1);
  let code = buildAutoTeamCode(slug, sequence);

  if (!isValidTeamCodeFormat(code)) {
    code = buildAutoTeamCode("T", sequence);
  }

  return { code, slug, sequence };
}
