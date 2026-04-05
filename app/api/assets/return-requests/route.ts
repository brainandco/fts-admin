import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

/** List pending + maintenance/damaged returns for admin read-only queue. */
export async function GET() {
  if (!(await can("assets.manage")) && !(await can("assets.return"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: queue, error: e1 } = await supabase
    .from("asset_return_requests")
    .select(
      "id, asset_id, from_employee_id, region_id, employee_comment, return_image_urls, status, pm_decision, pm_comment, processed_at, created_at"
    )
    .or("status.eq.pending,and(status.eq.processed,pm_decision.eq.Under_Maintenance),and(status.eq.processed,pm_decision.eq.Damaged)")
    .order("created_at", { ascending: true });

  if (e1) return NextResponse.json({ message: e1.message }, { status: 400 });

  const ids = [...new Set((queue ?? []).map((r) => r.asset_id))];
  const empIds = [...new Set((queue ?? []).map((r) => r.from_employee_id))];

  const { data: assets } = ids.length
    ? await supabase.from("assets").select("id, name, model, serial, imei_1, imei_2, category, status").in("id", ids)
    : { data: [] };
  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", empIds)
    : { data: [] };

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]));
  const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));

  const rows = (queue ?? []).map((r) => ({
    ...r,
    asset: assetMap.get(r.asset_id) ?? null,
    from_employee_name: empMap.get(r.from_employee_id) ?? null,
  }));

  /** PM decision is historical; list sections reflect current asset.status so cleared maintenance disappears from the queue. */
  const isStillUnderMaintenance = (r: (typeof rows)[0]) =>
    r.status === "processed" &&
    r.pm_decision === "Under_Maintenance" &&
    r.asset?.status === "Under_Maintenance";

  const isStillDamaged = (r: (typeof rows)[0]) =>
    r.status === "processed" && r.pm_decision === "Damaged" && r.asset?.status === "Damaged";

  return NextResponse.json({
    pending: rows.filter((r) => r.status === "pending"),
    under_maintenance: rows.filter(isStillUnderMaintenance),
    damaged: rows.filter(isStillDamaged),
  });
}
