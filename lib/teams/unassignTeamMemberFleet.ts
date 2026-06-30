import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteReceiptForResource } from "@/lib/resource-receipts";

export type TeamMemberFleetSummary = {
  assets: {
    id: string;
    name: string | null;
    serial: string | null;
    category: string | null;
    status: string | null;
    employee_id: string;
    employee_name: string;
  }[];
  sims: {
    id: string;
    sim_number: string | null;
    phone_number: string | null;
    status: string | null;
    employee_id: string;
    employee_name: string;
  }[];
  vehicles: {
    vehicle_id: string;
    plate_number: string | null;
    vehicle_type: string | null;
    status: string | null;
    employee_id: string;
    employee_name: string;
  }[];
};

export type TeamFleetUnassignResult = {
  assetsUnassigned: number;
  simsUnassigned: number;
  vehiclesUnassigned: number;
};

function uniqueMemberIds(dtId: string | null, drId: string | null): string[] {
  return [...new Set([dtId, drId].filter(Boolean))] as string[];
}

export async function fetchTeamMemberFleet(
  supabase: SupabaseClient,
  team: { dt_employee_id: string | null; driver_rigger_employee_id: string | null }
): Promise<TeamMemberFleetSummary> {
  const memberIds = uniqueMemberIds(team.dt_employee_id, team.driver_rigger_employee_id);
  if (memberIds.length === 0) {
    return { assets: [], sims: [], vehicles: [] };
  }

  const { data: employees } = await supabase.from("employees").select("id, full_name").in("id", memberIds);
  const nameById = new Map((employees ?? []).map((e) => [e.id as string, (e.full_name as string) ?? "—"]));

  const [assetsRes, simsRes, vehiclesRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, name, serial, category, status, assigned_to_employee_id")
      .in("assigned_to_employee_id", memberIds)
      .order("name"),
    supabase
      .from("sim_cards")
      .select("id, sim_number, phone_number, status, assigned_to_employee_id")
      .in("assigned_to_employee_id", memberIds)
      .eq("status", "Assigned")
      .order("sim_number"),
    supabase
      .from("vehicle_assignments")
      .select("vehicle_id, employee_id, vehicles(id, plate_number, vehicle_type, status)")
      .in("employee_id", memberIds),
  ]);

  type VehicleEmbed = { id: string; plate_number: string | null; vehicle_type: string | null; status: string | null };

  function one<T>(x: T | T[] | null | undefined): T | null {
    if (x == null) return null;
    return Array.isArray(x) ? (x[0] ?? null) : x;
  }

  const assets = (assetsRes.data ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string | null,
    serial: a.serial as string | null,
    category: a.category as string | null,
    status: a.status as string | null,
    employee_id: a.assigned_to_employee_id as string,
    employee_name: nameById.get(a.assigned_to_employee_id as string) ?? "—",
  }));

  const sims = (simsRes.data ?? []).map((s) => ({
    id: s.id as string,
    sim_number: s.sim_number as string | null,
    phone_number: s.phone_number as string | null,
    status: s.status as string | null,
    employee_id: s.assigned_to_employee_id as string,
    employee_name: nameById.get(s.assigned_to_employee_id as string) ?? "—",
  }));

  const vehicles = (vehiclesRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const v = one(row.vehicles as VehicleEmbed | VehicleEmbed[] | null);
    const employeeId = String(row.employee_id ?? "");
    return {
      vehicle_id: String(row.vehicle_id ?? v?.id ?? ""),
      plate_number: v?.plate_number ?? null,
      vehicle_type: v?.vehicle_type ?? null,
      status: v?.status ?? null,
      employee_id: employeeId,
      employee_name: nameById.get(employeeId) ?? "—",
    };
  });

  return { assets, sims, vehicles };
}

/** Admin unassign all tools, SIMs, and vehicles from team members (assignments cleared; resources return to Available). */
export async function unassignTeamMemberFleet(
  supabase: SupabaseClient,
  team: { dt_employee_id: string | null; driver_rigger_employee_id: string | null }
): Promise<TeamFleetUnassignResult> {
  const fleet = await fetchTeamMemberFleet(supabase, team);
  let assetsUnassigned = 0;
  let simsUnassigned = 0;
  let vehiclesUnassigned = 0;

  for (const asset of fleet.assets) {
    const { error } = await supabase
      .from("assets")
      .update({
        assigned_to_employee_id: null,
        assigned_by: null,
        assigned_at: null,
        status: "Available",
      })
      .eq("id", asset.id);
    if (error) throw error;
    await deleteReceiptForResource(supabase, "asset", asset.id);
    assetsUnassigned += 1;
  }

  for (const sim of fleet.sims) {
    const { error } = await supabase
      .from("sim_cards")
      .update({
        status: "Available",
        assigned_to_employee_id: null,
        assigned_by_user_id: null,
        assigned_at: null,
      })
      .eq("id", sim.id);
    if (error) throw error;
    await deleteReceiptForResource(supabase, "sim_card", sim.id);
    simsUnassigned += 1;
  }

  for (const row of fleet.vehicles) {
    if (!row.vehicle_id) continue;
    await supabase.from("vehicle_assignments").delete().eq("vehicle_id", row.vehicle_id);
    const { error } = await supabase
      .from("vehicles")
      .update({
        status: "Available",
        assigned_region_id: null,
        assigned_by: null,
        assigned_at: null,
      })
      .eq("id", row.vehicle_id);
    if (error) throw error;
    await deleteReceiptForResource(supabase, "vehicle", row.vehicle_id);
    vehiclesUnassigned += 1;
  }

  return { assetsUnassigned, simsUnassigned, vehiclesUnassigned };
}
