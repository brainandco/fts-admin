import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { assertEmployeesAllowedOnTeam } from "@/lib/teams/teamMemberEligibility";

export async function POST(req: Request) {
  if (!(await can("teams.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, dt_employee_id, driver_rigger_employee_id, max_size } = body;
  const onboarding_date = typeof body.onboarding_date === "string" ? body.onboarding_date.trim() : "";
  if (!name || !String(name).trim() || !dt_employee_id || !driver_rigger_employee_id || !onboarding_date) {
    return NextResponse.json({ message: "name, onboarding_date, dt_employee_id, and driver_rigger_employee_id are required" }, { status: 400 });
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
  const { data, error } = await supabase.from("teams").insert({
    name: String(name).trim(),
    project_id: null,
    region_id: null,
    dt_employee_id,
    driver_rigger_employee_id,
    max_size: max_size != null ? Number(max_size) : 2,
    onboarding_date,
  }).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "team", entityId: data.id, newValue: body, description: "Team created" });
  return NextResponse.json(data);
}
