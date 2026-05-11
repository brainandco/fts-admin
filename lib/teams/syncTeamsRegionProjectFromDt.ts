import type { SupabaseClient } from "@supabase/supabase-js";

/** Copy DT employee region/project onto every team row where they are the DT. */
export async function syncTeamsRegionProjectForDtEmployee(
  supabase: SupabaseClient,
  dtEmployeeId: string,
  region_id: string | null,
  project_id: string | null
): Promise<void> {
  await supabase.from("teams").update({ region_id, project_id }).eq("dt_employee_id", dtEmployeeId);
}

/**
 * Driver-only roster members cannot change primary assignment here (workflow is replace in Teams).
 * DT / Self DT may change assignment; new DT region must match each teammate Driver/Rigger's region (Self DT skipped).
 */
export async function assertDtAssignmentCompatibleWithTeams(
  supabase: SupabaseClient,
  dtEmployeeId: string,
  newRegionId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: dtTeams } = await supabase
    .from("teams")
    .select("id, name, team_code, driver_rigger_employee_id")
    .eq("dt_employee_id", dtEmployeeId);

  if (!dtTeams?.length) return { ok: true };

  if (!newRegionId) {
    return {
      ok: false,
      message:
        "Cannot clear region while this employee is the DT on a team. Remove or replace them in Teams first, or assign a region.",
    };
  }

  for (const t of dtTeams) {
    const drId = t.driver_rigger_employee_id;
    if (!drId || drId === dtEmployeeId) continue;

    const { data: dr } = await supabase.from("employees").select("region_id").eq("id", drId).single();
    if (!dr?.region_id || dr.region_id !== newRegionId) {
      const label = String(t.team_code ?? "").trim() || t.name || t.id;
      return {
        ok: false,
        message: `Team “${label}”: the Driver/Rigger must stay in the same primary region as the DT. Update the driver's region on Employee region & project assignments first, or choose the same region as the driver.`,
      };
    }
  }

  return { ok: true };
}
