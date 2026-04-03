import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamTerminationBlockers = {
  memberIds: string[];
  assetCount: number;
  simCount: number;
  vehicleCount: number;
  canTerminate: boolean;
};

/**
 * Team members are DT and Driver/Rigger (or Self DT: same id for both).
 * Termination is allowed only when no tools, SIMs, or vehicles remain assigned to any member.
 */
export async function getTeamTerminationBlockers(
  supabase: SupabaseClient,
  team: { dt_employee_id: string | null; driver_rigger_employee_id: string | null }
): Promise<TeamTerminationBlockers> {
  const memberIds = [
    ...new Set([team.dt_employee_id, team.driver_rigger_employee_id].filter(Boolean)),
  ] as string[];
  if (memberIds.length === 0) {
    return { memberIds, assetCount: 0, simCount: 0, vehicleCount: 0, canTerminate: true };
  }

  const [assetsRes, simsRes, vehiclesRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .in("assigned_to_employee_id", memberIds),
    supabase
      .from("sim_cards")
      .select("id", { count: "exact", head: true })
      .in("assigned_to_employee_id", memberIds)
      .eq("status", "Assigned"),
    supabase
      .from("vehicle_assignments")
      .select("id", { count: "exact", head: true })
      .in("employee_id", memberIds),
  ]);

  const assetCount = assetsRes.count ?? 0;
  const simCount = simsRes.count ?? 0;
  const vehicleCount = vehiclesRes.count ?? 0;
  const canTerminate = assetCount === 0 && simCount === 0 && vehicleCount === 0;

  return { memberIds, assetCount, simCount, vehicleCount, canTerminate };
}

export function teamTerminationBlockedMessage(blockers: TeamTerminationBlockers): string {
  const parts: string[] = [];
  if (blockers.assetCount > 0) {
    parts.push(
      `${blockers.assetCount} tool(s)/asset(s) still assigned to team members`
    );
  }
  if (blockers.simCount > 0) {
    parts.push(`${blockers.simCount} SIM card(s) still assigned to team members`);
  }
  if (blockers.vehicleCount > 0) {
    parts.push(`${blockers.vehicleCount} vehicle assignment(s) still active for team members`);
  }
  if (parts.length === 0) return "";
  return `Cannot terminate: ${parts.join("; ")}. Each team member must return all assets, SIMs, and vehicles via the Employee Portal (handover to QC) so nothing remains assigned before you terminate the team.`;
}
