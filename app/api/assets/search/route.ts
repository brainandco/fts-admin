import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";

/** GET /api/assets/search?q= — lightweight asset lookup for global search (top 20). */
export async function GET(req: Request) {
  if (!(await can("assets.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ assets: [] });
  }

  const supabase = await getDataClient();
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, asset_id, name, category, model, serial, imei_1, imei_2, status, assigned_to_employee_id, software_connectivity"
    )
    .eq("is_ehs_tool", false)
    .or(
      `name.ilike.${pattern},asset_id.ilike.${pattern},serial.ilike.${pattern},model.ilike.${pattern},imei_1.ilike.${pattern},imei_2.ilike.${pattern}`
    )
    .order("name")
    .limit(20);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  const empIds = [...new Set((data ?? []).map((a) => a.assigned_to_employee_id).filter(Boolean) as string[])];
  const { data: employees } = empIds.length
    ? await supabase.from("employees").select("id, full_name").in("id", empIds)
    : { data: [] };
  const nameById = new Map((employees ?? []).map((e) => [e.id, e.full_name ?? "—"]));

  const assets = (data ?? []).map((a) => ({
    id: a.id,
    asset_id: a.asset_id ?? null,
    name: a.name,
    category: a.category ?? null,
    model: a.model ?? null,
    serial: a.serial ?? null,
    imei_1: a.imei_1 ?? null,
    imei_2: a.imei_2 ?? null,
    status: a.status,
    assigned_name: a.assigned_to_employee_id ? nameById.get(a.assigned_to_employee_id) ?? "—" : "—",
    software_connectivity: a.software_connectivity ?? null,
  }));

  return NextResponse.json({ assets });
}
