import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — transfer requests list for Admin Lite mobile (read-only). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const canView =
    ctx.canViewApprovals ||
    ctx.isSuper ||
    ctx.permissions.has("assets.manage") ||
    ctx.permissions.has("assets.assign");
  if (!canView) {
    return NextResponse.json({ message: "You do not have access to transfer requests." }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "80", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(150, Math.max(1, limitRaw)) : 80;

  const supabase = await getDataClient();
  let query = supabase
    .from("transfer_requests")
    .select(
      "id, request_type, status, requester_employee_id, target_employee_id, target_team_id, asset_id, request_reason, notes, reviewer_comment, created_at, reviewed_at, requester_region_id"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const empIds = [
    ...new Set(
      (rows ?? []).flatMap((r) =>
        [r.requester_employee_id, r.target_employee_id].filter(Boolean) as string[]
      )
    ),
  ];
  const assetIds = [...new Set((rows ?? []).map((r) => r.asset_id).filter(Boolean) as string[])];
  const regionIds = [...new Set((rows ?? []).map((r) => r.requester_region_id).filter(Boolean) as string[])];
  const teamIds = [...new Set((rows ?? []).map((r) => r.target_team_id).filter(Boolean) as string[])];

  const [{ data: emps }, { data: assets }, { data: regions }, { data: teams }] = await Promise.all([
    empIds.length ? supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] },
    assetIds.length ? supabase.from("assets").select("id, name, serial, category").in("id", assetIds) : { data: [] },
    regionIds.length ? supabase.from("regions").select("id, name").in("id", regionIds) : { data: [] },
    teamIds.length ? supabase.from("teams").select("id, name").in("id", teamIds) : { data: [] },
  ]);

  const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]));
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

  const items = (rows ?? []).map((r) => {
    const asset = r.asset_id ? assetMap.get(r.asset_id) : null;
    return {
      id: r.id,
      requestType: r.request_type,
      status: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? null,
      requesterName: empMap.get(r.requester_employee_id) ?? r.requester_employee_id,
      targetName: r.target_employee_id
        ? empMap.get(r.target_employee_id) ?? r.target_employee_id
        : r.target_team_id
          ? teamMap.get(r.target_team_id) ?? "Team"
          : null,
      regionName: r.requester_region_id ? regionMap.get(r.requester_region_id) ?? null : null,
      reason: r.request_reason ?? null,
      notes: r.notes ?? null,
      reviewerComment: r.reviewer_comment ?? null,
      assetLabel: asset
        ? [asset.name, asset.serial].filter(Boolean).join(" · ") || asset.id
        : null,
    };
  });

  return NextResponse.json({
    items,
    pendingCount: items.filter((i) => i.status === "Pending").length,
    total: items.length,
  });
}
