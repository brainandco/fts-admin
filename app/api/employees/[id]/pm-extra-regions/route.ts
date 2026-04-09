import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

const PM = "Project Manager";

/**
 * PUT — Super User only. Replaces extra region rows for a PM (beyond employees.region_id).
 * Body: { region_ids: string[] }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("employees.manage"))) {
    return NextResponse.json({ message: "You do not have permission to assign extra PM regions." }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = body.region_ids;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ message: "region_ids must be an array of UUID strings." }, { status: 400 });
  }
  const regionIds = [...new Set(raw.map((x: unknown) => String(x).trim()).filter(Boolean))];

  const supabase = await getDataClient();
  const { data: emp, error: eErr } = await supabase.from("employees").select("id, region_id, email, full_name").eq("id", employeeId).single();
  if (eErr || !emp) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: roles } = await supabase.from("employee_roles").select("role").eq("employee_id", employeeId);
  const isPm = (roles ?? []).some((r) => r.role === PM);
  if (!isPm) {
    return NextResponse.json({ message: "Extra regions apply only to Project Manager role." }, { status: 400 });
  }

  if (emp.region_id && regionIds.includes(emp.region_id)) {
    return NextResponse.json(
      { message: "Do not include the employee primary region in extra regions; it is already applied." },
      { status: 400 }
    );
  }

  if (regionIds.length) {
    const { data: regions } = await supabase.from("regions").select("id").in("id", regionIds);
    if ((regions ?? []).length !== regionIds.length) {
      return NextResponse.json({ message: "One or more region ids are invalid." }, { status: 400 });
    }
  }

  await supabase.from("pm_region_assignments").delete().eq("employee_id", employeeId);
  if (regionIds.length) {
    const { error: insErr } = await supabase.from("pm_region_assignments").insert(
      regionIds.map((region_id) => ({ employee_id: employeeId, region_id }))
    );
    if (insErr) return NextResponse.json({ message: insErr.message }, { status: 400 });
  }

  await auditLog({
    actionType: "update",
    entityType: "employee",
    entityId: employeeId,
    oldValue: { pm_extra_regions: "replaced" },
    newValue: { region_ids: regionIds },
    description: "PM extra region assignments updated (Super User)",
  });

  return NextResponse.json({ ok: true, region_ids: regionIds });
}
