import type { SupabaseClient } from "@supabase/supabase-js";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { buildRegionFlatAssignees } from "./team-region-lists";

/**
 * Ensures the employee appears in the flat region assignee list for the resource type.
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
 * Picks a region for `assigned_region_id` from the employee's primary region only.
 */
export async function resolveAssetAssignmentRegion(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ ok: true; regionId: string } | { ok: false; message: string }> {
  const { data: emp } = await supabase.from("employees").select("region_id").eq("id", employeeId).maybeSingle();
  if (!emp) return { ok: false, message: "Employee not found." };

  if (!emp.region_id) {
    return {
      ok: false,
      message:
        "This employee needs a primary region on their profile before assets can be assigned.",
    };
  }

  const regionId = emp.region_id as string;
  const check = await assertAssigneeAllowedInRegion(supabase, regionId, "asset", employeeId);
  if (check.ok) return { ok: true, regionId };

  return {
    ok: false,
    message:
      "This employee cannot receive this asset. They need an eligible role (e.g. DT or Self DT) and a primary region on their profile.",
  };
}

/**
 * Region for EHS tools assigned directly to a Driver/Rigger (or Self DT).
 */
export async function resolveEhsAssignmentRegion(
  supabase: SupabaseClient,
  employeeId: string
): Promise<{ ok: true; regionId: string } | { ok: false; message: string }> {
  const active = await assertEmployeesActiveForAssignment(supabase, [employeeId]);
  if (!active.ok) return active;

  const { data: emp } = await supabase.from("employees").select("region_id").eq("id", employeeId).maybeSingle();
  if (!emp) return { ok: false, message: "Employee not found." };

  if (emp.region_id) {
    return { ok: true, regionId: emp.region_id as string };
  }

  return {
    ok: false,
    message:
      "This Driver/Rigger needs a primary region on their employee profile before EHS tools can be assigned.",
  };
}
