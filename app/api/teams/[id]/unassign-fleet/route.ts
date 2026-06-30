import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { unassignTeamMemberFleet } from "@/lib/teams/unassignTeamMemberFleet";

async function canUnassignTeamFleet(): Promise<boolean> {
  if (!(await can("teams.manage"))) return false;
  return (
    (await can("assets.manage")) ||
    (await can("assets.assign")) ||
    (await can("vehicles.manage")) ||
    (await can("vehicles.assign"))
  );
}

/** POST — unassign all tools, SIMs, and vehicles from this team's DT and Driver/Rigger. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canUnassignTeamFleet())) {
    return NextResponse.json({ message: "You do not have permission to unassign team fleet items." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: team, error } = await supabase.from("teams").select("id, name, dt_employee_id, driver_rigger_employee_id").eq("id", id).single();
  if (error || !team) return NextResponse.json({ message: "Team not found" }, { status: 404 });

  try {
    const result = await unassignTeamMemberFleet(supabase, team);
    await auditLog({
      actionType: "update",
      entityType: "team",
      entityId: id,
      description: `Unassigned team fleet: ${result.assetsUnassigned} asset(s), ${result.simsUnassigned} SIM(s), ${result.vehiclesUnassigned} vehicle(s)`,
      newValue: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unassign failed";
    return NextResponse.json({ message }, { status: 400 });
  }
}
