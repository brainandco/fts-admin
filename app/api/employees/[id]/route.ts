import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can edit employees." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const supabase = await getDataClient();

  const { data: old } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
  if (body.passport_number !== undefined) {
    const raw = body.passport_number;
    updates.passport_number =
      raw === null || raw === "" ? "" : typeof raw === "string" ? raw.trim() : String(raw).trim();
  }
  if (body.country !== undefined) updates.country = String(body.country).trim();
  if (body.email !== undefined) updates.email = String(body.email).trim();
  if (body.phone !== undefined) updates.phone = String(body.phone).trim();
  if (body.iqama_number !== undefined) updates.iqama_number = String(body.iqama_number).trim();
  /* region / project: use PATCH /api/employees/[id]/assignment only */
  if (body.status !== undefined) updates.status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  if (body.onboarding_date !== undefined) updates.onboarding_date = body.onboarding_date || null;
  if (body.accommodations !== undefined) {
    updates.accommodations = typeof body.accommodations === "string" ? body.accommodations.trim() || null : null;
  }

  const final = { ...old, ...updates } as Record<string, unknown>;
  const required = ["full_name", "country", "email", "phone", "iqama_number", "onboarding_date"];
  for (const key of required) {
    const v = final[key];
    if (v === undefined || v === null || String(v).trim() === "") {
      return NextResponse.json({ message: `${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} is required` }, { status: 400 });
    }
  }
  const { error } = await supabase.from("employees").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  if (Array.isArray(body.roles)) {
    const allowed = ["Driver/Rigger", "QC", "QA", "PP", "DT", "Project Manager", "Self DT"];
    const newRoles = body.roles.filter((r: string) => allowed.includes(r));
    if (newRoles.length !== 1) {
      return NextResponse.json({ message: "Exactly one role is required." }, { status: 400 });
    }
    const nextRole = newRoles[0];
    if (nextRole === "QC" || nextRole === "QA" || nextRole === "PP" || nextRole === "Project Manager") {
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id")
        .or(`dt_employee_id.eq.${id},driver_rigger_employee_id.eq.${id}`)
        .limit(1);
      if (teamRows && teamRows.length > 0) {
        return NextResponse.json(
          {
            message:
              "QC, QA, PP, and Project Manager cannot be on a team. Remove this employee from their team first, then change this role.",
          },
          { status: 400 }
        );
      }
    }
    await supabase.from("employee_roles").delete().eq("employee_id", id);
    await supabase.from("employee_roles").insert({ employee_id: id, role: nextRole });
  }

  await auditLog({ actionType: "update", entityType: "employee", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Employee updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can delete employees." }, { status: 403 });

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { data: teamsUsingEmployee } = await supabase
    .from("teams")
    .select("id, name")
    .or(`dt_employee_id.eq.${id},driver_rigger_employee_id.eq.${id}`);
  if (teamsUsingEmployee && teamsUsingEmployee.length > 0) {
    return NextResponse.json(
      {
        message: "This employee is assigned to one or more teams. To delete this employee, you must first replace them in every team where they are assigned. Go to each team, replace this member (DT or Driver/Rigger) with another employee, then delete the employee.",
        teams: teamsUsingEmployee,
        code: "EMPLOYEE_IN_USE_IN_TEAMS",
      },
      { status: 400 }
    );
  }

  const { count: vehicleAssignmentsCount } = await supabase
    .from("vehicle_assignments")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id);
  if ((vehicleAssignmentsCount ?? 0) > 0) {
    return NextResponse.json(
      {
        message: "This employee has vehicles assigned. Unassign all vehicles from this employee (Vehicles → edit assignment) before deleting the employee.",
        code: "EMPLOYEE_HAS_VEHICLE_ASSIGNMENTS",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({ actionType: "delete", entityType: "employee", entityId: id, oldValue: old, description: "Employee deleted" });
  return NextResponse.json({ ok: true });
}
