import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { deleteEmployeeById } from "@/lib/employees/delete-employee-internal";
import { normalizeEmployeeRolePayload, ROLES_NOT_ALLOWED_ON_TEAM } from "@/lib/employees/employee-role-options";
import { employeeIdentityConflict } from "@/lib/data-uniqueness";
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
  const identityClash = await employeeIdentityConflict(
    supabase,
    {
      email: String(final.email).trim(),
      passport_number: String(final.passport_number).trim(),
      iqama_number: String(final.iqama_number).trim(),
    },
    id
  );
  if (identityClash) return NextResponse.json({ message: identityClash }, { status: 400 });

  const { error } = await supabase.from("employees").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  if (Array.isArray(body.roles)) {
    const roleNorm = normalizeEmployeeRolePayload({
      roles: body.roles,
      role_custom: body.role_custom,
    });
    if (!roleNorm.ok) {
      return NextResponse.json({ message: roleNorm.message }, { status: 400 });
    }
    const nextRole = roleNorm.role;
    if (ROLES_NOT_ALLOWED_ON_TEAM.has(nextRole)) {
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id")
        .or(`dt_employee_id.eq.${id},driver_rigger_employee_id.eq.${id}`)
        .limit(1);
      if (teamRows && teamRows.length > 0) {
        return NextResponse.json(
          {
            message:
              "This role cannot be on a team. Remove this employee from their team first, then change the role.",
          },
          { status: 400 }
        );
      }
    }
    await supabase.from("employee_roles").delete().eq("employee_id", id);
    await supabase.from("employee_roles").insert({
      employee_id: id,
      role: roleNorm.role,
      role_custom: roleNorm.role_custom,
    });
  }

  await auditLog({ actionType: "update", entityType: "employee", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Employee updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can delete employees." }, { status: 403 });

  const { id } = await params;
  const result = await deleteEmployeeById(id);
  if (!result.ok) {
    const body: Record<string, unknown> = { message: result.message };
    if (result.code) body.code = result.code;
    if (result.teams) body.teams = result.teams;
    if (result.blocks) body.blocks = result.blocks;
    return NextResponse.json(body, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
