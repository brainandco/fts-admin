import type { SupabaseClient } from "@supabase/supabase-js";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { buildRegionFlatAssignees } from "./team-region-lists";

/**
 * Ensures the employee appears in the flat region assignee list for the resource type (same pool as team-grouped views, without requiring a team).
 */
export async function assertAssigneeAllowedInRegion(
  supabase: SupabaseClient,
  regionId: string,
  variant: "asset" | "vehicle" | "sim",
  employeeId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const active = await assertEmployeesActiveForAssignment(supabase, [employeeId]);
  if (!active.ok) return active;

  const list = await buildRegionFlatAssignees(supabase, regionId, variant);
  if (!list.some((e) => e.id === employeeId)) {
    return { ok: false, message: "Employee is not eligible for assignment in this region." };
  }
  return { ok: true };
}
