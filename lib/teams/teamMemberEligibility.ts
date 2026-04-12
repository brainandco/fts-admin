import type { SupabaseClient } from "@supabase/supabase-js";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { ROLES_NOT_ALLOWED_ON_TEAM } from "@/lib/employees/employee-role-options";

/** QC, QA, PP, PM, PC, and support roles are not eligible for DT / Driver-Rigger / Self-DT team slots. */
export async function assertEmployeesAllowedOnTeam(
  supabase: SupabaseClient,
  employeeIds: (string | null | undefined)[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(employeeIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return { ok: true };

  const active = await assertEmployeesActiveForAssignment(supabase, ids);
  if (!active.ok) return active;

  const { data: rows, error } = await supabase
    .from("employee_roles")
    .select("employee_id, role")
    .in("employee_id", ids);

  if (error) return { ok: false, message: error.message };

  const byEmp = new Map<string, string[]>();
  for (const r of rows ?? []) {
    const arr = byEmp.get(r.employee_id) ?? [];
    arr.push(r.role);
    byEmp.set(r.employee_id, arr);
  }

  for (const id of ids) {
    const roles = byEmp.get(id) ?? [];
    if (roles.some((role) => ROLES_NOT_ALLOWED_ON_TEAM.has(role))) {
      return {
        ok: false,
        message:
          "This role cannot be on a team (QC, QA, PP, PM, PC, or any custom / Other role).",
      };
    }
  }
  return { ok: true };
}
