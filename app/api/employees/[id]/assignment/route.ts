import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { EMPLOYEE_RECORD_PROJECT_ROLES } from "@/lib/employees/employee-record-project-roles";

/**
 * PATCH — Super User only. Sets region and formal project for an employee.
 * PM / QA / PP / Project Coordinator / Self DT: when region is set, project_id must be set and must belong to that region.
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
      const { data: proj, error: pErr } = await supabase
        .from("projects")
        .select("id, region_id")
        .eq("id", project_id)
        .single();
      if (pErr || !proj) return NextResponse.json({ message: "Invalid project" }, { status: 400 });
      if (proj.region_id !== region_id) {
        return NextResponse.json({ message: "Project must belong to the selected region." }, { status: 400 });
      }
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
