import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { resolveAssetAssignmentRegion } from "@/lib/admin-assignment/validate-assignee";
import { upsertPendingReceipts } from "@/lib/resource-receipts";
import type { EhsWearRole } from "@/lib/assets/ehs-tool-catalog";

async function assertDtEmployee(supabase: Awaited<ReturnType<typeof getDataClient>>, employeeId: string) {
  const { data: roles } = await supabase.from("employee_roles").select("role").eq("employee_id", employeeId);
  const set = new Set((roles ?? []).map((r) => r.role as string));
  const isDt =
    set.has("DT") || set.has("Junior DT") || set.has("Self DT");
  if (!isDt) return { ok: false as const, message: "EHS tools must be assigned to a DT (including Junior DT / Self DT)." };
  return { ok: true as const };
}

async function resolveDriverForDt(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  dtEmployeeId: string,
  driverEmployeeId: string | null
) {
  const { data: team } = await supabase
    .from("teams")
    .select("id, driver_rigger_employee_id")
    .eq("dt_employee_id", dtEmployeeId)
    .maybeSingle();

  if (!team?.driver_rigger_employee_id) {
    return { ok: false as const, message: "This DT has no Driver/Rigger on their team. Add a driver to the team first." };
  }

  if (driverEmployeeId && driverEmployeeId !== team.driver_rigger_employee_id) {
    return { ok: false as const, message: "Selected driver does not belong to this DT's team." };
  }

  return { ok: true as const, driverId: team.driver_rigger_employee_id as string };
}

export async function POST(req: Request) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const assetIds = Array.isArray(body.asset_ids) ? body.asset_ids.filter((id: unknown) => typeof id === "string") : [];
  const dtEmployeeId = typeof body.dt_employee_id === "string" ? body.dt_employee_id.trim() : "";
  const driverEmployeeId =
    typeof body.driver_employee_id === "string" && body.driver_employee_id.trim()
      ? body.driver_employee_id.trim()
      : null;

  if (!dtEmployeeId || assetIds.length === 0) {
    return NextResponse.json({ message: "asset_ids and dt_employee_id required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const active = await assertEmployeesActiveForAssignment(supabase, [dtEmployeeId]);
  if (!active.ok) return NextResponse.json({ message: active.message }, { status: 400 });

  const dtCheck = await assertDtEmployee(supabase, dtEmployeeId);
  if (!dtCheck.ok) return NextResponse.json({ message: dtCheck.message }, { status: 400 });

  const regionResolved = await resolveAssetAssignmentRegion(supabase, dtEmployeeId);
  if (!regionResolved.ok) return NextResponse.json({ message: regionResolved.message }, { status: 400 });

  const { data: assets } = await supabase
    .from("assets")
    .select("id, status, assigned_to_employee_id, ehs_wear_role, is_ehs_tool")
    .in("id", assetIds)
    .eq("is_ehs_tool", true)
    .eq("status", "Available");

  const available = (assets ?? []).filter((a) => !a.assigned_to_employee_id);
  const skipped = assetIds.length - available.length;

  let teamDriverId: string | null = null;
  const needsDriver = available.some((a) => a.ehs_wear_role === "driver_rigger");
  if (needsDriver) {
    const driverResolved = await resolveDriverForDt(supabase, dtEmployeeId, driverEmployeeId);
    if (!driverResolved.ok) return NextResponse.json({ message: driverResolved.message }, { status: 400 });
    teamDriverId = driverResolved.driverId;
  }

  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const now = new Date().toISOString();

  const assignedIds: string[] = [];

  for (const row of available) {
    const wearRole = row.ehs_wear_role as EhsWearRole | null;
    const updates: Record<string, unknown> = {
      assigned_to_employee_id: dtEmployeeId,
      assigned_region_id: regionResolved.regionId,
      status: "Assigned",
      assigned_by: user?.id ?? null,
      assigned_at: now,
      ehs_for_employee_id: wearRole === "driver_rigger" ? teamDriverId : null,
    };

    await supabase.from("assets").update(updates).eq("id", row.id);
    assignedIds.push(row.id as string);

    if (user?.id) {
      await supabase.from("asset_assignment_history").insert({
        asset_id: row.id,
        to_employee_id: dtEmployeeId,
        assigned_by_user_id: user.id,
        notes:
          wearRole === "driver_rigger" && teamDriverId
            ? `EHS driver/rigger tool for team driver (${teamDriverId})`
            : "EHS DT tool",
      });
    }

    await auditLog({
      actionType: "update",
      entityType: "asset",
      entityId: row.id as string,
      newValue: updates,
      description: "EHS tool assigned (bulk)",
    });
  }

  if (assignedIds.length > 0) {
    await upsertPendingReceipts(supabase, {
      employeeId: dtEmployeeId,
      assignedByUserId: user?.id ?? null,
      items: assignedIds.map((resourceId) => ({ resourceType: "asset" as const, resourceId })),
    });
  }

  return NextResponse.json({
    assigned: assignedIds.length,
    skipped,
    message:
      skipped > 0
        ? `Assigned ${assignedIds.length} EHS tool(s). ${skipped} were not available and skipped.`
        : `Assigned ${assignedIds.length} EHS tool(s).`,
  });
}

/** GET teams with DT + driver for assign UI */
export async function GET() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await getDataClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, region_id, dt_employee_id, driver_rigger_employee_id")
    .not("dt_employee_id", "is", null)
    .order("name");

  const empIds = [
    ...new Set(
      (teams ?? []).flatMap((t) => [t.dt_employee_id, t.driver_rigger_employee_id].filter(Boolean) as string[])
    ),
  ];

  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name, email, region_id, status").in("id", empIds)
    : { data: [] };

  const empMap = new Map(
    (emps ?? []).map((e) => [e.id, { id: e.id, full_name: e.full_name, email: e.email, region_id: e.region_id, status: e.status }])
  );

  const dtAssignees = (teams ?? [])
    .filter((t) => {
      const dt = t.dt_employee_id ? empMap.get(t.dt_employee_id as string) : null;
      return dt && dt.status === "ACTIVE";
    })
    .map((t) => {
      const dt = empMap.get(t.dt_employee_id as string)!;
      const driver = t.driver_rigger_employee_id ? empMap.get(t.driver_rigger_employee_id as string) : null;
      return {
        teamId: t.id,
        teamName: t.name,
        regionId: t.region_id,
        dt: { id: dt.id, full_name: dt.full_name ?? dt.email ?? "DT" },
        driver: driver
          ? { id: driver.id, full_name: driver.full_name ?? driver.email ?? "Driver/Rigger" }
          : null,
      };
    });

  return NextResponse.json({ teams: dtAssignees });
}
