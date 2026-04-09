import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

const PM = "Project Manager";

/**
 * PUT — Super User, users.edit, or employees.manage. Replaces project rows for a PM (multiple projects for team scope).
 * Body: { project_ids: string[] }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("users.edit")) && !(await can("employees.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = body.project_ids;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ message: "project_ids must be an array of UUID strings." }, { status: 400 });
  }
  const projectIds = [...new Set(raw.map((x: unknown) => String(x).trim()).filter(Boolean))];

  const supabase = await getDataClient();
  const { data: emp, error: eErr } = await supabase.from("employees").select("id, email, full_name").eq("id", employeeId).single();
  if (eErr || !emp) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: roles } = await supabase.from("employee_roles").select("role").eq("employee_id", employeeId);
  const isPm = (roles ?? []).some((r) => r.role === PM);
  if (!isPm) {
    return NextResponse.json({ message: "PM projects apply only to Project Manager role." }, { status: 400 });
  }

  if (projectIds.length) {
    const { data: projects } = await supabase.from("projects").select("id").in("id", projectIds);
    if ((projects ?? []).length !== projectIds.length) {
      return NextResponse.json({ message: "One or more project ids are invalid." }, { status: 400 });
    }
  }

  await supabase.from("pm_employee_projects").delete().eq("employee_id", employeeId);
  if (projectIds.length) {
    const { error: insErr } = await supabase.from("pm_employee_projects").insert(
      projectIds.map((project_id) => ({ employee_id: employeeId, project_id }))
    );
    if (insErr) return NextResponse.json({ message: insErr.message }, { status: 400 });
  }

  await auditLog({
    actionType: "update",
    entityType: "employee",
    entityId: employeeId,
    oldValue: { pm_projects: "replaced" },
    newValue: { project_ids: projectIds },
    description: "PM project assignments updated",
  });

  return NextResponse.json({ ok: true, project_ids: projectIds });
}
