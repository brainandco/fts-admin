import type { SupabaseClient } from "@supabase/supabase-js";
import { EHS_ID_PREFIX, getEhsToolType, type EhsWearRole } from "@/lib/assets/ehs-tool-catalog";

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

/** Next ASTEHS-{ABBREV}-{num} for a tool type + wear role pool. */
export async function computeNextEhsAssetId(
  supabase: SupabaseClient,
  toolTypeKey: string,
  wearRole: EhsWearRole
): Promise<string | null> {
  const def = getEhsToolType(toolTypeKey);
  if (!def) return null;
  if (!def.wearRoles.includes(wearRole)) return null;

  const { data: rows, error } = await supabase
    .from("assets")
    .select("asset_id")
    .eq("is_ehs_tool", true)
    .eq("ehs_tool_type", def.key)
    .eq("ehs_wear_role", wearRole);
  if (error) return null;

  const ids = (rows ?? []).map((r) => r.asset_id as string | null);
  const max = maxForEhsPrefix(ids, def.idAbbrev);
  const next = max > 0 ? max + 1 : def.idStart;
  return formatEhsAssetId(def.idAbbrev, next);
}
