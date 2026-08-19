import { NextResponse } from "next/server";
import { pmEmployeeIdSet } from "@/lib/employees/pm-role";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** GET — PM asset returns pending admin confirmation (Admin Lite mobile). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(ctx.isSuper || ctx.permissions.has("assets.manage") || ctx.permissions.has("assets.return"))) {
    return NextResponse.json({ message: "You do not have access to asset returns." }, { status: 403 });
  }

  const supabase = await getDataClient();
  const { data: queue, error } = await supabase
    .from("asset_return_requests")
    .select(
      "id, asset_id, from_employee_id, employee_comment, return_image_urls, status, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const pmIds = await pmEmployeeIdSet(
    supabase,
    (queue ?? []).map((r) => r.from_employee_id as string)
  );
  const pmRows = (queue ?? []).filter((r) => pmIds.has(r.from_employee_id as string));

  const assetIds = [...new Set(pmRows.map((r) => r.asset_id))];
  const empIds = [...new Set(pmRows.map((r) => r.from_employee_id))];

  const [{ data: assets }, { data: emps }] = await Promise.all([
    assetIds.length
      ? supabase.from("assets").select("id, name, model, serial, category").in("id", assetIds)
      : { data: [] },
    empIds.length ? supabase.from("employees").select("id, full_name").in("id", empIds) : { data: [] },
  ]);

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]));
  const empMap = new Map((emps ?? []).map((e) => [e.id, e.full_name]));

  const items = pmRows.map((r) => {
    const asset = assetMap.get(r.asset_id);
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      employeeComment: r.employee_comment ?? null,
      returnImageCount: Array.isArray(r.return_image_urls) ? r.return_image_urls.length : 0,
      fromEmployeeName: empMap.get(r.from_employee_id) ?? null,
      asset: asset
        ? {
            id: asset.id,
            name: asset.name ?? null,
            model: asset.model ?? null,
            serial: asset.serial ?? null,
            category: asset.category ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ items, pendingCount: items.length });
}
