import type { SupabaseClient } from "@supabase/supabase-js";
import { EHS_ID_PREFIX, getEhsToolType } from "@/lib/assets/ehs-tool-catalog";

function maxForEhsPrefix(assetIds: (string | null)[], abbrev: string): number {
  const esc = `${EHS_ID_PREFIX}-${abbrev}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}-(\\d+)$`, "i");
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

export function formatEhsAssetId(abbrev: string, num: number): string {
  return `${EHS_ID_PREFIX}-${abbrev}-${num}`;
}

/** Next ASTEHS-{ABBREV}-{num} for a tool type (global pool). */
export async function computeNextEhsAssetId(
  supabase: SupabaseClient,
  toolTypeKey: string
): Promise<string | null> {
  const def = getEhsToolType(toolTypeKey);
  if (!def) return null;

  const { data: rows, error } = await supabase
    .from("assets")
    .select("asset_id")
    .eq("is_ehs_tool", true)
    .eq("ehs_tool_type", def.key);
  if (error) return null;

  const ids = (rows ?? []).map((r) => r.asset_id as string | null);
  const max = maxForEhsPrefix(ids, def.idAbbrev);
  const next = max >= def.idStart ? max + 1 : def.idStart;
  return formatEhsAssetId(def.idAbbrev, next);
}
