import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { getTeamRegionProjectFromDtEmployee, assertDtAndDriverSameRegionForTeam } from "@/lib/teams/teamRegionProjectFromDt";
import { assertDtAssignmentCompatibleWithTeams } from "@/lib/teams/syncTeamsRegionProjectFromDt";

/**
 * POST — Super User only. Re-reads region/project from the team's DT (or Self DT) employee row and updates this team.
 * Use after fixing stale team row or when the DT record was updated outside the normal assignment flow.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can sync team project." }, { status: 403 });

  const { id: teamId } = await params;
  const supabase = await getDataClient();
  const { data: team, error } = await supabase.from("teams").select("*").eq("id", teamId).single();
  if (error || !team) return NextResponse.json({ message: "Team not found" }, { status: 404 });

  const dtId = (team as { dt_employee_id?: string | null }).dt_employee_id;
  const drId = (team as { driver_rigger_employee_id?: string | null }).driver_rigger_employee_id;
  if (!dtId || !drId) {
    return NextResponse.json({ message: "Team must have a DT and Driver/Rigger assigned." }, { status: 400 });
  }

  const sameRegion = await assertDtAndDriverSameRegionForTeam(supabase, dtId, drId);
  if (!sameRegion.ok) {
    return NextResponse.json({ message: sameRegion.message }, { status: 400 });
  }

  const fromDt = await getTeamRegionProjectFromDtEmployee(supabase, dtId);
  if (!fromDt.region_id) {
    return NextResponse.json(
      { message: "DT has no primary region on Employee region & project assignments." },
      { status: 400 }
    );
  }

  const compat = await assertDtAssignmentCompatibleWithTeams(supabase, dtId, fromDt.region_id);
  if (!compat.ok) {
    return NextResponse.json({ message: compat.message }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("teams")
    .update({ region_id: fromDt.region_id, project_id: fromDt.project_id })
    .eq("id", teamId);
  if (updErr) return NextResponse.json({ message: updErr.message }, { status: 400 });

  await auditLog({
    actionType: "update",
    entityType: "team",
    entityId: teamId,
    oldValue: team as Record<string, unknown>,
    newValue: { ...(team as Record<string, unknown>), region_id: fromDt.region_id, project_id: fromDt.project_id },
    description: "Team region/project synced from DT employee record",
  });

  return NextResponse.json({
    ok: true,
    region_id: fromDt.region_id,
    project_id: fromDt.project_id,
  });
}
