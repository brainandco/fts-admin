import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Team `region_id` and `project_id` are copied from the DT's employee record (Self DT: same person).
 * No separate team-level region/project assignment in Admin.
 */
export async function getTeamRegionProjectFromDtEmployee(
  supabase: SupabaseClient,
  dtEmployeeId: string
): Promise<{ region_id: string | null; project_id: string | null }> {
  const { data: emp, error } = await supabase
    .from("employees")
    .select("region_id, project_id")
    .eq("id", dtEmployeeId)
    .single();
  if (error || !emp) {
    return { region_id: null, project_id: null };
  }
  return {
    region_id: (emp.region_id as string | null) ?? null,
    project_id: (emp.project_id as string | null) ?? null,
  };
}

/** Standard team: DT and Driver/Rigger must share the same primary region (Self DT: skipped). */
export async function assertDtAndDriverSameRegionForTeam(
  supabase: SupabaseClient,
  dtEmployeeId: string,
  driverEmployeeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (dtEmployeeId === driverEmployeeId) return { ok: true };

  const { data: rows, error } = await supabase
    .from("employees")
    .select("id, region_id")
    .in("id", [dtEmployeeId, driverEmployeeId]);

  if (error || !rows || rows.length < 2) {
    return { ok: false, message: "Could not load DT and Driver/Rigger employees." };
  }

  const dt = rows.find((r) => r.id === dtEmployeeId);
  const dr = rows.find((r) => r.id === driverEmployeeId);
  if (!dt?.region_id || !dr?.region_id) {
    return {
      ok: false,
      message:
        "Both DT and Driver/Rigger must have a primary region (People → Employee region & project assignments).",
    };
  }
  if (dt.region_id !== dr.region_id) {
    return { ok: false, message: "Driver/Rigger must be in the same region as the DT." };
  }
  return { ok: true };
}
