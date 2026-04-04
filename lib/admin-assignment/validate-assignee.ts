import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTeamRegionAssigneeLists } from "./team-region-lists";

/**
 * Ensures the employee appears in the team/region assignee lists for the given region.
 * When `targetTeamId` is set, the employee must be listed under that team (including synthetic region group).
 */
export async function assertAssigneeAllowedForRegionTeam(
  supabase: SupabaseClient,
  regionId: string,
  variant: "asset" | "vehicle" | "sim",
  employeeId: string,
  targetTeamId?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { teams } = await buildTeamRegionAssigneeLists(supabase, regionId, variant);
  const teamId = typeof targetTeamId === "string" ? targetTeamId.trim() : "";
  if (teamId) {
    const t = teams.find((x) => x.teamId === teamId);
    if (!t) return { ok: false, message: "Invalid team for this region." };
    if (!t.members.some((m) => m.id === employeeId)) {
      return { ok: false, message: "Selected employee is not on that team for this assignment." };
    }
    return { ok: true };
  }
  const any = teams.some((t) => t.members.some((m) => m.id === employeeId));
  if (!any) {
    return { ok: false, message: "Employee is not eligible for assignment in this region." };
  }
  return { ok: true };
}
