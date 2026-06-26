import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import {
  bulkUnassignAssets,
  countAssetsForBulkUnassign,
  type BulkUnassignScope,
} from "@/lib/assets/bulk-unassign";

const CONFIRM_PHRASE = "UNASSIGN_ALL_ASSETS";

function parseScope(body: { region_id?: unknown; all_regions?: unknown }): BulkUnassignScope {
  const allRegions = body.all_regions === true;
  const regionId = typeof body.region_id === "string" ? body.region_id.trim() : "";
  if (allRegions || !regionId) return { mode: "all" };
  return { mode: "regions", regionIds: [regionId] };
}

/** GET — preview how many assets would be unassigned. ?region_id=uuid or ?all_regions=1 */
export async function GET(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const allRegions = url.searchParams.get("all_regions") === "1";
  const regionId = url.searchParams.get("region_id")?.trim() ?? "";
  const scope: BulkUnassignScope =
    allRegions || !regionId ? { mode: "all" } : { mode: "regions", regionIds: [regionId] };

  const supabase = await getDataClient();
  try {
    const count = await countAssetsForBulkUnassign(supabase, scope);
    return NextResponse.json({ count, scope: scope.mode === "all" ? "all" : "region" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Preview failed";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

/** POST — bulk unassign all currently assigned assets (optionally one region). Admin only. */
export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { message: `Send confirm: "${CONFIRM_PHRASE}" in the JSON body.` },
      { status: 400 }
    );
  }

  const scope = parseScope(body);
  const supabase = await getDataClient();
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  try {
    const { unassignedCount, assetIds } = await bulkUnassignAssets(supabase, scope);
    await auditLog({
      actionType: "update",
      entityType: "asset",
      entityId: null,
      description:
        scope.mode === "all"
          ? `Bulk unassigned ${unassignedCount} asset(s) organization-wide`
          : `Bulk unassigned ${unassignedCount} asset(s) for region`,
      newValue: { scope, unassignedCount, sampleIds: assetIds.slice(0, 20) },
      actorUserId: user?.id ?? null,
      actorEmail: user?.email ?? null,
    });
    return NextResponse.json({ ok: true, unassignedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bulk unassign failed";
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
