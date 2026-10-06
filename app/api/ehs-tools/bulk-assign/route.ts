import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { resolveEhsAssignmentRegion } from "@/lib/admin-assignment/validate-assignee";
import { upsertPendingReceipts } from "@/lib/resource-receipts";
import { DRIVER_RIGGER_ROLE } from "@/lib/employees/driver-iqama";

async function assertDriverRigger(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  employeeId: string
) {
  const { data: roles } = await supabase.from("employee_roles").select("role").eq("employee_id", employeeId);
  const set = new Set((roles ?? []).map((r) => r.role as string));
  // Self DT covers driver slot historically; include for continuity.
  if (!set.has(DRIVER_RIGGER_ROLE) && !set.has("Self DT")) {
    return {
      ok: false as const,
      message: "EHS tools must be assigned directly to a Driver/Rigger (or Self DT).",
    };
  }
  return { ok: true as const };
}

/** Assign available EHS tools directly to a Driver/Rigger (receipt on that employee). */
export async function POST(req: Request) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const assetIds = Array.isArray(body.asset_ids)
    ? body.asset_ids.filter((id: unknown) => typeof id === "string")
    : [];
  const employeeId =
    typeof body.employee_id === "string"
      ? body.employee_id.trim()
      : typeof body.driver_employee_id === "string"
        ? body.driver_employee_id.trim()
        : "";

  if (!employeeId || assetIds.length === 0) {
    return NextResponse.json({ message: "asset_ids and employee_id (Driver/Rigger) required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const active = await assertEmployeesActiveForAssignment(supabase, [employeeId]);
  if (!active.ok) return NextResponse.json({ message: active.message }, { status: 400 });

  const roleCheck = await assertDriverRigger(supabase, employeeId);
  if (!roleCheck.ok) return NextResponse.json({ message: roleCheck.message }, { status: 400 });

  const regionResolved = await resolveEhsAssignmentRegion(supabase, employeeId);
  if (!regionResolved.ok) return NextResponse.json({ message: regionResolved.message }, { status: 400 });

  const { data: assets } = await supabase
    .from("assets")
    .select("id, status, assigned_to_employee_id, is_ehs_tool")
    .in("id", assetIds)
    .eq("is_ehs_tool", true)
    .eq("status", "Available");

  const available = (assets ?? []).filter((a) => !a.assigned_to_employee_id);
  const skipped = assetIds.length - available.length;

  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const now = new Date().toISOString();

  const assignedIds: string[] = [];

  for (const row of available) {
    const updates: Record<string, unknown> = {
      assigned_to_employee_id: employeeId,
      assigned_region_id: regionResolved.regionId,
      status: "Assigned",
      assigned_by: user?.id ?? null,
      assigned_at: now,
      // Direct custody on driver; wear metadata kept for catalog compatibility.
      ehs_wear_role: "driver_rigger",
      ehs_for_employee_id: null,
    };

    await supabase.from("assets").update(updates).eq("id", row.id);
    assignedIds.push(row.id as string);

    if (user?.id) {
      await supabase.from("asset_assignment_history").insert({
        asset_id: row.id,
        to_employee_id: employeeId,
        assigned_by_user_id: user.id,
        notes: "EHS tool assigned directly to Driver/Rigger",
      });
    }

    await auditLog({
      actionType: "update",
      entityType: "asset",
      entityId: row.id as string,
      newValue: updates,
      description: "EHS tool assigned (bulk, direct to driver)",
    });
  }

  if (assignedIds.length > 0) {
    await upsertPendingReceipts(supabase, {
      employeeId,
      assignedByUserId: user?.id ?? null,
      items: assignedIds.map((resourceId) => ({ resourceType: "asset" as const, resourceId })),
    });
  }

  return NextResponse.json({
    assigned: assignedIds.length,
    skipped,
    message:
      skipped > 0
        ? `Assigned ${assignedIds.length} EHS tool(s) to Driver/Rigger. ${skipped} were not available and skipped.`
        : `Assigned ${assignedIds.length} EHS tool(s) to Driver/Rigger.`,
  });
}

/** Active Driver/Rigger (and Self DT) employees for EHS assign UI — no teams. */
export async function GET() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const supabase = await getDataClient();
  const { data: roleRows } = await supabase
    .from("employee_roles")
    .select("employee_id, role")
    .in("role", [DRIVER_RIGGER_ROLE, "Self DT"]);

  const empIds = [...new Set((roleRows ?? []).map((r) => r.employee_id as string))];
  if (empIds.length === 0) return NextResponse.json({ drivers: [] });

  const { data: emps } = await supabase
    .from("employees")
    .select("id, full_name, email, region_id, status")
    .in("id", empIds)
    .eq("status", "ACTIVE")
    .order("full_name");

  const drivers = (emps ?? []).map((e) => ({
    id: e.id as string,
    full_name: ((e.full_name as string | null) ?? (e.email as string | null) ?? "Driver/Rigger").trim(),
    region_id: (e.region_id as string | null) ?? null,
  }));

  return NextResponse.json({ drivers });
}
