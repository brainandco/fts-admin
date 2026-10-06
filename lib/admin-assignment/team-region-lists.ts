import type { SupabaseClient } from "@supabase/supabase-js";
import { isVehicleAssigneeRole } from "@/lib/employees/vehicle-assignment-roles";
import { ADMIN_REGION_FALLBACK_TEAM_ID } from "./constants";

export type TeamMemberPick = {
  teamId: string;
  teamName: string;
  members: { id: string; full_name: string }[];
};

type EmpRow = { id: string; full_name: string | null };

function isAssetTargetRole(roles: Set<string>): boolean {
  return (
    roles.has("DT") ||
    roles.has("Junior DT") ||
    roles.has("Self DT") ||
    roles.has("PP") ||
    roles.has("Reporting Team")
  );
}

function isVehicleTargetRole(roles: Set<string>): boolean {
  return [...roles].some((r) => isVehicleAssigneeRole(r));
}

function isSimTargetRole(roles: Set<string>): boolean {
  if (roles.has("QC")) return false;
  return (
    roles.has("DT") ||
    roles.has("Junior DT") ||
    roles.has("Driver/Rigger") ||
    roles.has("Self DT") ||
    roles.has("QA") ||
    roles.has("PP") ||
    roles.has("Project Manager") ||
    roles.has("Project Coordinator") ||
    roles.has("Reporting Team")
  );
}

async function loadRoleMap(supabase: SupabaseClient, employeeIds: string[]) {
  if (employeeIds.length === 0) return new Map<string, Set<string>>();
  const { data: rows } = await supabase.from("employee_roles").select("employee_id, role").in("employee_id", employeeIds);
  const m = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    if (!m.has(r.employee_id)) m.set(r.employee_id, new Set());
    m.get(r.employee_id)!.add(r.role as string);
  }
  return m;
}

/**
 * Region assignee lists (flat, no teams table).
 * Shape kept as `teams` for older UI that expects grouped pickers — one region bucket only.
 */
export async function buildTeamRegionAssigneeLists(
  supabase: SupabaseClient,
  regionId: string,
  variant: "asset" | "vehicle" | "sim"
): Promise<{
  teams: TeamMemberPick[];
  teamLabels: Record<string, string>;
}> {
  const { data: regionEmployees } = await supabase
    .from("employees")
    .select("id, full_name, region_id, status")
    .eq("region_id", regionId)
    .eq("status", "ACTIVE");

  const regionIds = (regionEmployees ?? []).map((e) => e.id);
  const roleMap = await loadRoleMap(supabase, regionIds);

  const empById = new Map<string, EmpRow>();
  for (const e of regionEmployees ?? []) empById.set(e.id, { id: e.id, full_name: e.full_name });

  function eligible(id: string): boolean {
    const roles = roleMap.get(id) ?? new Set<string>();
    if (variant === "asset") return isAssetTargetRole(roles);
    if (variant === "vehicle") return isVehicleTargetRole(roles);
    return isSimTargetRole(roles);
  }

  const members: { id: string; full_name: string }[] = [];
  for (const e of regionEmployees ?? []) {
    if (!eligible(e.id)) continue;
    const row = empById.get(e.id);
    if (!row) continue;
    members.push({ id: e.id, full_name: row.full_name ?? e.id });
  }
  members.sort((a, b) => a.full_name.localeCompare(b.full_name));

  const bucketName =
    variant === "vehicle" ? "Vehicle assignees in region" : "Employees in region";

  const teamsOut: TeamMemberPick[] =
    members.length > 0
      ? [
          {
            teamId: ADMIN_REGION_FALLBACK_TEAM_ID,
            teamName: bucketName,
            members,
          },
        ]
      : [];

  const teamLabels: Record<string, string> = {
    [ADMIN_REGION_FALLBACK_TEAM_ID]: "Region",
  };

  return { teams: teamsOut, teamLabels };
}

/** All eligible assignees in the region as a single sorted list (deduped). */
export async function buildRegionFlatAssignees(
  supabase: SupabaseClient,
  regionId: string,
  variant: "asset" | "vehicle" | "sim"
): Promise<{ id: string; full_name: string }[]> {
  const { teams } = await buildTeamRegionAssigneeLists(supabase, regionId, variant);
  const seen = new Map<string, string>();
  for (const t of teams) {
    for (const m of t.members) {
      if (!seen.has(m.id)) seen.set(m.id, m.full_name);
    }
  }
  return [...seen.entries()]
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * All employees eligible for asset assignment across every region.
 * `display_label` includes a region hint for disambiguation.
 */
export async function buildGlobalAssetAssignees(
  supabase: SupabaseClient
): Promise<{ id: string; display_label: string }[]> {
  const { data: allRegions } = await supabase.from("regions").select("id, name").order("name");
  const regionNames = new Map((allRegions ?? []).map((r) => [r.id as string, r.name as string]));
  const seen = new Map<string, string>();
  const idToRegions = new Map<string, Set<string>>();

  for (const r of allRegions ?? []) {
    const rid = r.id as string;
    const list = await buildRegionFlatAssignees(supabase, rid, "asset");
    for (const e of list) {
      if (!seen.has(e.id)) seen.set(e.id, e.full_name);
      if (!idToRegions.has(e.id)) idToRegions.set(e.id, new Set());
      idToRegions.get(e.id)!.add(rid);
    }
  }

  const empIds = [...seen.keys()];
  if (empIds.length === 0) return [];

  const { data: empRows } = await supabase.from("employees").select("id, region_id").in("id", empIds);
  const empRegion = new Map((empRows ?? []).map((e) => [e.id as string, e.region_id as string | null]));

  const out: { id: string; display_label: string }[] = [];
  for (const id of empIds) {
    const full_name = seen.get(id)!;
    const erid = empRegion.get(id) ?? null;
    const primaryName = erid ? regionNames.get(erid) : null;
    const fallbackRegs = [...(idToRegions.get(id) ?? [])]
      .map((rid) => regionNames.get(rid) ?? rid)
      .sort((a, b) => a.localeCompare(b));
    const regionSuffix = primaryName ?? (fallbackRegs.length ? fallbackRegs.join(", ") : "");
    out.push({
      id,
      display_label: regionSuffix ? `${full_name} — ${regionSuffix}` : full_name,
    });
  }
  out.sort((a, b) => a.display_label.localeCompare(b.display_label));
  return out;
}
