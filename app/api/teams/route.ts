import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { assertEmployeesAllowedOnTeam } from "@/lib/teams/teamMemberEligibility";
import {
  assertDtAndDriverSameRegionForTeam,
  getTeamRegionProjectFromDtEmployee,
} from "@/lib/teams/teamRegionProjectFromDt";
import { isValidTeamCodeFormat, normalizeTeamCode } from "@/lib/teams/teamCode";

export async function POST(req: Request) {
  if (!(await can("teams.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, dt_employee_id, driver_rigger_employee_id, max_size } = body;
  const onboarding_date = typeof body.onboarding_date === "string" ? body.onboarding_date.trim() : "";
  const team_code = typeof body.team_code === "string" ? normalizeTeamCode(body.team_code) : "";
  if (!name || !String(name).trim() || !dt_employee_id || !driver_rigger_employee_id || !onboarding_date) {
    return NextResponse.json({ message: "name, onboarding_date, dt_employee_id, and driver_rigger_employee_id are required" }, { status: 400 });
  }
  if (!team_code) {
    return NextResponse.json({ message: "team_code is required (unique code for segregating teams, e.g. T-R01)" }, { status: 400 });
  }
  if (!isValidTeamCodeFormat(team_code)) {
    return NextResponse.json(
      {
        message:
          "team_code must be 2–32 characters: letters, numbers, underscore, or hyphen (e.g. TEAM-01, T_R01)",
      },
      { status: 400 }
    );
  }
  const supabase = await createServerSupabaseClient();
  const { data: conflict } = await supabase
    .from("teams")
    .select("id")
    .or(`dt_employee_id.eq.${dt_employee_id},driver_rigger_employee_id.eq.${dt_employee_id},dt_employee_id.eq.${driver_rigger_employee_id},driver_rigger_employee_id.eq.${driver_rigger_employee_id}`)
    .maybeSingle();
  if (conflict?.id) {
    return NextResponse.json({ message: "Selected employee is already assigned in another team. Release/replace first." }, { status: 400 });
  }
  const eligible = await assertEmployeesAllowedOnTeam(supabase, [dt_employee_id, driver_rigger_employee_id]);
  if (!eligible.ok) {
    return NextResponse.json({ message: eligible.message }, { status: 400 });
  }
  const sameRegion = await assertDtAndDriverSameRegionForTeam(supabase, dt_employee_id, driver_rigger_employee_id);
  if (!sameRegion.ok) {
    return NextResponse.json({ message: sameRegion.message }, { status: 400 });
  }
  const { region_id, project_id } = await getTeamRegionProjectFromDtEmployee(supabase, dt_employee_id);
  if (!region_id) {
    return NextResponse.json(
      { message: "DT must have a primary region before creating a team (Employee region & project assignments)." },
      { status: 400 }
    );
  }
  const { data, error } = await supabase.from("teams").insert({
    name: String(name).trim(),
    team_code,
    project_id,
    region_id,
    dt_employee_id,
    driver_rigger_employee_id,
    max_size: max_size != null ? Number(max_size) : 2,
    onboarding_date,
  }).select("id").single();
  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message ?? "")) {
      return NextResponse.json({ message: "This team code is already in use. Choose another." }, { status: 400 });
    }
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  await auditLog({ actionType: "create", entityType: "team", entityId: data.id, newValue: body, description: "Team created" });
  return NextResponse.json(data);
}
