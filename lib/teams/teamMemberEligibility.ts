import type { SupabaseClient } from "@supabase/supabase-js";

const ROLES_NOT_ALLOWED_ON_TEAM = new Set(["QC", "QA", "PP", "Project Manager", "Project Coordinator"]);

/** QC, QA, PP, and PM are not eligible for DT / Driver-Rigger / Self-DT team slots. */
export async function assertEmployeesAllowedOnTeam(
  supabase: SupabaseClient,
  employeeIds: (string | null | undefined)[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [...new Set(employeeIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return { ok: true };

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
        message: "QC, QA, PP, Project Manager, and Project Coordinator cannot be members of a team.",
      };
    }
  }
  return { ok: true };
}
