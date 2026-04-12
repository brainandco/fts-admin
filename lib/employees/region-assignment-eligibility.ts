import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamRef = { id: string; label: string };

/** Lists teams where the employee is DT or Driver/Rigger (includes Self DT: one row, one role). */
export async function fetchTeamsForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<TeamRef[]> {
  const { data: rows } = await supabase
    .from("teams")
    .select("id, name, team_code")
    .or(`dt_employee_id.eq.${employeeId},driver_rigger_employee_id.eq.${employeeId}`);
  if (!rows?.length) return [];
  return rows.map((t) => ({
    id: t.id,
    label: String(t.team_code ?? "").trim() || t.name || t.id,
  }));
}

export function formatTeamListForMessage(teams: TeamRef[]): string {
  return teams.map((t) => t.label).join(", ");
}
