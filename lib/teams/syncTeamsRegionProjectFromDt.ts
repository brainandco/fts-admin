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
 * When a DT's region changes, move each teammate Driver/Rigger to the same primary region.
 * Assets, vehicles, and SIMs stay assigned as-is.
 */
export async function syncTeammateDriversRegionFromDt(
  supabase: SupabaseClient,
  dtEmployeeId: string,
  newRegionId: string | null
): Promise<void> {
  if (!newRegionId) return;

  const { data: dtTeams } = await supabase
    .from("teams")
    .select("driver_rigger_employee_id")
    .eq("dt_employee_id", dtEmployeeId);

  const driverIds = [
    ...new Set(
      (dtTeams ?? [])
        .map((t) => t.driver_rigger_employee_id as string | null)
        .filter((id): id is string => !!id && id !== dtEmployeeId)
    ),
  ];

  if (driverIds.length === 0) return;

  await supabase.from("employees").update({ region_id: newRegionId }).in("id", driverIds);
}

/**
 * Driver-only roster members cannot change primary assignment here (workflow is replace in Teams).
 * DT / Self DT may change assignment; teammate Driver/Rigger regions are updated with the DT.
 */
export async function assertDtAssignmentCompatibleWithTeams(
  supabase: SupabaseClient,
  dtEmployeeId: string,
  newRegionId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: dtTeams } = await supabase
    .from("teams")
    .select("id")
    .eq("dt_employee_id", dtEmployeeId);

  if (!dtTeams?.length) return { ok: true };

  if (!newRegionId) {
    return {
      ok: false,
      message:
        "Cannot clear region while this employee is the DT on a team. Remove or replace them in Teams first, or assign a region.",
    };
  }

  return { ok: true };
}
