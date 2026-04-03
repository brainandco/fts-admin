import type { SupabaseClient } from "@supabase/supabase-js";

export type EmployeeAssignmentCounts = {
  assets: number;
  sims: number;
  vehicles: number;
};

export async function getEmployeeAssignmentCounts(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeAssignmentCounts> {
  const [assetsRes, simsRes, vehiclesRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_employee_id", employeeId),
    supabase
      .from("sim_cards")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_employee_id", employeeId)
      .eq("status", "Assigned"),
    supabase
      .from("vehicle_assignments")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", employeeId),
  ]);
  return {
    assets: assetsRes.count ?? 0,
    sims: simsRes.count ?? 0,
    vehicles: vehiclesRes.count ?? 0,
  };
}

/** Team member replacement is blocked until the outgoing employee has returned all tools, SIMs, and vehicles (nothing assigned). */
export async function assertEmployeeHasNoAssignmentsForTeamChange(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const c = await getEmployeeAssignmentCounts(supabase, employeeId);
  if (c.assets === 0 && c.sims === 0 && c.vehicles === 0) return { ok: true };
  const parts: string[] = [];
  if (c.assets > 0) parts.push(`${c.assets} asset(s)`);
  if (c.sims > 0) parts.push(`${c.sims} SIM(s)`);
  if (c.vehicles > 0) parts.push(`${c.vehicles} vehicle(s)`);
  return {
    ok: false,
    message: `Cannot replace this team member yet: they still have ${parts.join(", ")} assigned. They must return everything via the Employee Portal (hand over to QC) before you can assign someone else.`,
  };
}
