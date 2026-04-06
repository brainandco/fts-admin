import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { EMPLOYEE_RECORD_PROJECT_ROLES } from "@/lib/employees/employee-record-project-roles";

/**
 * PATCH — Super User only. Sets region and formal project for an employee.
 * PM / QA / PP / Project Coordinator / Self DT: when one of region or project is set, both must be set (project is not tied to region in the catalog).
 * Other roles: project_id is cleared.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) {
    return NextResponse.json({ message: "Only Super User can assign region and project." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const regionRaw = body.region_id;
  const projectRaw = body.project_id;

  const region_id =
    regionRaw === null || regionRaw === ""
      ? null
      : typeof regionRaw === "string"
        ? regionRaw.trim() || null
        : null;
  const project_id =
    projectRaw === null || projectRaw === ""
      ? null
      : typeof projectRaw === "string"
        ? projectRaw.trim() || null
        : null;

  const supabase = await getDataClient();
  const { data: old, error: fetchErr } = await supabase.from("employees").select("*").eq("id", id).single();
  if (fetchErr || !old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: roleRows } = await supabase.from("employee_roles").select("role").eq("employee_id", id);
  const role = (roleRows ?? [])[0]?.role ?? "";

  if (EMPLOYEE_RECORD_PROJECT_ROLES.has(role)) {
    if (region_id && !project_id) {
      return NextResponse.json(
        { message: "Select a project for Project Manager, QA, PP, Project Coordinator, and Self DT when a region is set." },
        { status: 400 }
      );
    }
    if (project_id && !region_id) {
      return NextResponse.json({ message: "Select a region before assigning a project." }, { status: 400 });
    }
    if (region_id && project_id) {
      const { data: proj, error: pErr } = await supabase.from("projects").select("id").eq("id", project_id).single();
      if (pErr || !proj) return NextResponse.json({ message: "Invalid project" }, { status: 400 });
    }
  } else {
    if (project_id) {
      return NextResponse.json(
        { message: "Only Project Manager, QA, PP, Project Coordinator, and Self DT can have a project on their employee record." },
        { status: 400 }
      );
    }
  }

  const updates = {
    region_id,
    project_id: EMPLOYEE_RECORD_PROJECT_ROLES.has(role) ? project_id : null,
    project_name_other: null,
  };

  const { error } = await supabase.from("employees").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const { data: asDtTeams } = await supabase.from("teams").select("id").eq("dt_employee_id", id);
  if ((asDtTeams ?? []).length > 0) {
    await supabase
      .from("teams")
      .update({ region_id: updates.region_id, project_id: updates.project_id })
      .eq("dt_employee_id", id);
  }

  await auditLog({
    actionType: "update",
    entityType: "employee",
    entityId: id,
    oldValue: old,
    newValue: { ...old, ...updates },
    description: "Region and project assignment updated",
  });

  return NextResponse.json({ ok: true });
}
