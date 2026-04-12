import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT } from "@/lib/rbac/permission-codes";
import { auditLog } from "@/lib/audit/log";
import { employeeMayHaveFormalProjectOnRecord } from "@/lib/employees/employee-record-project-roles";
import {
  fetchTeamsForEmployee,
  formatTeamListForMessage,
} from "@/lib/employees/region-assignment-eligibility";

/**
 * PATCH — requires `employees.assign_region_project` (or Super User). Sets region and formal project for an employee.
 * Driver/Rigger and QC: region only (project_id cleared).
 * All other roles may have project_id; project requires a region. Region without project is allowed (e.g. DT for team matching).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can(PERMISSION_EMPLOYEE_ASSIGN_REGION_PROJECT))) {
    return NextResponse.json(
      { message: "You do not have permission to assign region and project for employees." },
      { status: 403 }
    );
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

  const status = String((old as { status?: string }).status ?? "ACTIVE");
  const teamsForEmp = await fetchTeamsForEmployee(supabase, id);

  if (status !== "ACTIVE") {
    const teamHint =
      teamsForEmp.length > 0
        ? ` They are still listed on team(s): ${formatTeamListForMessage(teamsForEmp)}. After reactivation, update or replace them in Teams if they should not remain on a roster.`
        : "";
    return NextResponse.json(
      {
        message: `Inactive employees cannot have region or project assigned or changed. Reactivate the employee on their profile first.${teamHint}`,
      },
      { status: 400 }
    );
  }

  if (teamsForEmp.length > 0) {
    return NextResponse.json(
      {
        message: `This employee is on a team (${formatTeamListForMessage(
          teamsForEmp
        )}). In Teams, replace or remove them before changing region or project.`,
      },
      { status: 400 }
    );
  }

  const { data: roleRows } = await supabase.from("employee_roles").select("role").eq("employee_id", id);
  const role = (roleRows ?? [])[0]?.role ?? "";

  const mayHaveProject = employeeMayHaveFormalProjectOnRecord(role);

  if (!mayHaveProject && project_id) {
    return NextResponse.json(
      { message: "Driver/Rigger and QC cannot have a formal project on their employee record (region only)." },
      { status: 400 }
    );
  }

  if (mayHaveProject && project_id && !region_id) {
    return NextResponse.json({ message: "Select a region before assigning a project." }, { status: 400 });
  }

  if (mayHaveProject && project_id) {
    const { data: proj, error: pErr } = await supabase.from("projects").select("id").eq("id", project_id).single();
    if (pErr || !proj) return NextResponse.json({ message: "Invalid project" }, { status: 400 });
  }

  const updates = {
    region_id,
    project_id: mayHaveProject ? project_id : null,
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
