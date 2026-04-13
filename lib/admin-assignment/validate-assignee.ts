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

/**
 * Picks a region for `assigned_region_id` when the client does not send one: employee primary region first,
 * then team regions where they are DT, using the same eligibility rules as the assignee list.
 */
export async function resolveAssetAssignmentRegion(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ ok: true; regionId: string } | { ok: false; message: string }> {
  const { data: emp } = await supabase.from("employees").select("region_id").eq("id", employeeId).maybeSingle();
  if (!emp) return { ok: false, message: "Employee not found." };

  const candidates: string[] = [];
  if (emp.region_id) candidates.push(emp.region_id as string);

  const { data: teams } = await supabase.from("teams").select("region_id").eq("dt_employee_id", employeeId);
  for (const t of teams ?? []) {
    const rid = t.region_id as string | null;
    if (rid && !candidates.includes(rid)) candidates.push(rid);
  }

  for (const regionId of candidates) {
    const check = await assertAssigneeAllowedInRegion(supabase, regionId, "asset", employeeId);
    if (check.ok) return { ok: true, regionId };
  }

  return {
    ok: false,
    message:
      "This employee cannot receive this asset. They need the DT or Self DT role and must match a region (on their profile or as DT on a team in that region).",
  };
}
