import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import {
  getTeamTerminationBlockers,
  teamTerminationBlockedMessage,
} from "@/lib/teams/teamTermination";
import { assertEmployeesAllowedOnTeam } from "@/lib/teams/teamMemberEligibility";
import {
  assertDtAndDriverSameRegionForTeam,
  getTeamRegionProjectFromDtEmployee,
} from "@/lib/teams/teamRegionProjectFromDt";
import { assertEmployeeHasNoAssignmentsForTeamChange } from "@/lib/teams/employeeAssignments";
import { isValidTeamCodeFormat, normalizeTeamCode } from "@/lib/teams/teamCode";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can edit teams." }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("teams").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.dt_employee_id !== undefined) updates.dt_employee_id = body.dt_employee_id;
  if (body.driver_rigger_employee_id !== undefined) updates.driver_rigger_employee_id = body.driver_rigger_employee_id;
  if (body.max_size !== undefined) updates.max_size = body.max_size == null ? null : Number(body.max_size);
  if (body.onboarding_date !== undefined) updates.onboarding_date = body.onboarding_date || null;

  const final = { ...old, ...updates } as Record<string, unknown>;
  const required = ["name", "dt_employee_id", "driver_rigger_employee_id", "onboarding_date"];
  for (const key of required) {
    const v = final[key];
    if (v === undefined || v === null || String(v).trim() === "") {
      return NextResponse.json({ message: `${key} is required` }, { status: 400 });
    }
  }

  const oldDt = (old as { dt_employee_id?: string }).dt_employee_id;
  const oldDr = (old as { driver_rigger_employee_id?: string }).driver_rigger_employee_id;
  const newDt = body.dt_employee_id ?? oldDt;
  const newDr = body.driver_rigger_employee_id ?? oldDr;
  const { data: conflict } = await supabase
    .from("teams")
    .select("id")
    .neq("id", id)
    .or(`dt_employee_id.eq.${newDt},driver_rigger_employee_id.eq.${newDt},dt_employee_id.eq.${newDr},driver_rigger_employee_id.eq.${newDr}`)
    .maybeSingle();
  if (conflict?.id) {
    return NextResponse.json({ message: "Selected employee is already assigned in another team. Release/replace first." }, { status: 400 });
  }
  const eligible = await assertEmployeesAllowedOnTeam(supabase, [newDt, newDr]);
  if (!eligible.ok) {
    return NextResponse.json({ message: eligible.message }, { status: 400 });
  }
  const sameRegion = await assertDtAndDriverSameRegionForTeam(supabase, newDt as string, newDr as string);
  if (!sameRegion.ok) {
    return NextResponse.json({ message: sameRegion.message }, { status: 400 });
  }
  const fromDt = await getTeamRegionProjectFromDtEmployee(supabase, newDt as string);
  if (!fromDt.region_id) {
    return NextResponse.json(
      { message: "DT must have a primary region (Employee region & project assignments)." },
      { status: 400 }
    );
  }
  updates.region_id = fromDt.region_id;
  updates.project_id = fromDt.project_id;

  if (oldDt && newDt !== oldDt) {
    const cleared = await assertEmployeeHasNoAssignmentsForTeamChange(supabase, oldDt);
    if (!cleared.ok) return NextResponse.json({ message: cleared.message }, { status: 400 });
  }
  if (oldDr && newDr !== oldDr) {
    const cleared = await assertEmployeeHasNoAssignmentsForTeamChange(supabase, oldDr);
    if (!cleared.ok) return NextResponse.json({ message: cleared.message }, { status: 400 });
  }

  const { profile } = await getCurrentUserProfile();
  const replacedBy = profile?.id ?? null;

  if (oldDt !== newDt && newDt) {
    await supabase.from("team_replacements").insert({
      team_id: id,
      role: "DT",
      previous_employee_id: oldDt || null,
      new_employee_id: newDt,
      replaced_by: replacedBy,
    });
  }
  if (oldDr !== newDr && newDr) {
    await supabase.from("team_replacements").insert({
      team_id: id,
      role: "Driver/Rigger",
      previous_employee_id: oldDr || null,
      new_employee_id: newDr,
      replaced_by: replacedBy,
    });
  }

  const { error } = await supabase.from("teams").update(updates).eq("id", id);
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message ?? "")) {
      return NextResponse.json({ message: "This team code is already in use. Choose another." }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  await auditLog({ actionType: "update", entityType: "team", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Team updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superResult = await requireSuper();
  if (!superResult.allowed) return NextResponse.json({ message: "Only Super User can delete (terminate) teams." }, { status: 403 });
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("teams").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const dataClient = await getDataClient();
  const blockers = await getTeamTerminationBlockers(dataClient, {
    dt_employee_id: (old as { dt_employee_id?: string | null }).dt_employee_id ?? null,
    driver_rigger_employee_id: (old as { driver_rigger_employee_id?: string | null }).driver_rigger_employee_id ?? null,
  });
  if (!blockers.canTerminate) {
    return NextResponse.json(
      { message: teamTerminationBlockedMessage(blockers) },
      { status: 400 }
    );
  }
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "delete", entityType: "team", entityId: id, oldValue: old, description: "Team terminated" });
  return NextResponse.json({ ok: true });
}
