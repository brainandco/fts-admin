import type { SupabaseClient } from "@supabase/supabase-js";

/** Shown when assigning resources or team roles to an inactive employee. */
export const INACTIVE_EMPLOYEE_ASSIGNMENT_MESSAGE =
  "This employee is inactive. Reactivate them on their employee profile in the Admin Portal before assigning assets, vehicles, SIMs, or team roles.";

/**
 * Ensures every listed employee exists and has status ACTIVE (assignments, team DT/DR, etc.).
 */
export async function assertEmployeesActiveForAssignment(
  supabase: SupabaseClient,
  employeeIds: (string | null | undefined)[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ids = [
    ...new Set(
      employeeIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    ),
  ];
  if (ids.length === 0) return { ok: true };

  const { data: rows, error } = await supabase.from("employees").select("id, status").in("id", ids);
  if (error) return { ok: false, message: error.message };

  const byId = new Map((rows ?? []).map((r) => [r.id, r.status as string]));
  for (const id of ids) {
    const st = byId.get(id);
    if (st !== "ACTIVE") {
      return { ok: false, message: INACTIVE_EMPLOYEE_ASSIGNMENT_MESSAGE };
    }
  }
  return { ok: true };
}
