import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { sendEmployeePortalCredentials } from "@/lib/employees/send-employee-portal-credentials";

/**
 * POST /api/teams/[id]/send-member-credentials
 * Sends employee portal credentials (same as per-employee resend) to each current team member (DT + Driver/Rigger).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("teams.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id: teamId } = await params;
  const supabase = await getDataClient();
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, dt_employee_id, driver_rigger_employee_id")
    .eq("id", teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ message: "Team not found" }, { status: 404 });
  }

  const rawIds = [team.dt_employee_id, team.driver_rigger_employee_id].filter(
    (x): x is string => typeof x === "string" && x.length > 0
  );
  const memberIds = [...new Set(rawIds)];

  if (memberIds.length === 0) {
    return NextResponse.json({ message: "This team has no members assigned yet.", results: [] }, { status: 400 });
  }

  const results: Array<{
    employeeId: string;
    role: "dt" | "driver_rigger";
    email?: string;
    fullName?: string;
    credentialsSent: boolean;
    credentialsError?: string;
    temporaryPassword?: string;
    error?: string;
  }> = [];

  for (const employeeId of memberIds) {
    const role: "dt" | "driver_rigger" =
      team.dt_employee_id === employeeId && team.driver_rigger_employee_id === employeeId
        ? "dt"
        : team.dt_employee_id === employeeId
          ? "dt"
          : "driver_rigger";

    const result = await sendEmployeePortalCredentials(employeeId);
    if (!result.ok) {
      results.push({
        employeeId,
        role,
        credentialsSent: false,
        error: result.message,
      });
      continue;
    }
    results.push({
      employeeId,
      role,
      email: result.email,
      fullName: result.fullName,
      credentialsSent: result.credentialsSent,
      credentialsError: result.credentialsError,
      temporaryPassword: result.temporaryPassword,
    });
  }

  const sentCount = results.filter((r) => r.credentialsSent).length;
  const hardErrors = results.filter((r) => r.error).length;
  const emailFailed = results.filter((r) => !r.error && !r.credentialsSent).length;

  return NextResponse.json({
    teamId: team.id,
    teamName: team.name,
    memberCount: memberIds.length,
    results,
    summary: {
      credentialsEmailedOk: sentCount,
      emailDeliveryFailed: emailFailed,
      otherErrors: hardErrors,
    },
  });
}
