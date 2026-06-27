import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { assertEmployeesActiveForAssignment } from "@/lib/employees/active-for-assignment";
import { resolveAssetAssignmentRegion } from "@/lib/admin-assignment/validate-assignee";
import { upsertPendingReceipts } from "@/lib/resource-receipts";

export async function POST(req: Request) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const assetIds = Array.isArray(body.asset_ids) ? body.asset_ids.filter((id: unknown) => typeof id === "string") : [];
  const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  if (!employeeId || assetIds.length === 0) {
    return NextResponse.json({ message: "asset_ids and employee_id required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const active = await assertEmployeesActiveForAssignment(supabase, [employeeId]);
  if (!active.ok) return NextResponse.json({ message: active.message }, { status: 400 });

  const { data: qcRole } = await supabase
    .from("employee_roles")
    .select("role")
    .eq("employee_id", employeeId)
    .eq("role", "QC")
    .maybeSingle();
  if (qcRole) return NextResponse.json({ message: "Assets cannot be assigned to QC." }, { status: 400 });

  const regionResolved = await resolveAssetAssignmentRegion(supabase, employeeId);
  if (!regionResolved.ok) return NextResponse.json({ message: regionResolved.message }, { status: 400 });

  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const now = new Date().toISOString();

  const { data: assets } = await supabase
    .from("assets")
    .select("id, status, assigned_to_employee_id")
    .in("id", assetIds)
    .eq("status", "Available");
  const availableIds = (assets ?? [])
    .filter((a) => !a.assigned_to_employee_id)
    .map((a) => a.id as string);
  const skipped = assetIds.length - availableIds.length;

  for (const id of availableIds) {
    const updates = {
      assigned_to_employee_id: employeeId,
      assigned_region_id: regionResolved.regionId,
      status: "Assigned",
      assigned_by: user?.id ?? null,
      assigned_at: now,
    };
    await supabase.from("assets").update(updates).eq("id", id);
    if (user?.id) {
      await supabase.from("asset_assignment_history").insert({
        asset_id: id,
        to_employee_id: employeeId,
        assigned_by_user_id: user.id,
      });
    }
    await auditLog({
      actionType: "update",
      entityType: "asset",
      entityId: id,
      newValue: updates,
      description: "Asset assigned (bulk)",
    });
  }

  if (availableIds.length > 0) {
    await upsertPendingReceipts(supabase, {
      employeeId,
      assignedByUserId: user?.id ?? null,
      items: availableIds.map((resourceId) => ({ resourceType: "asset" as const, resourceId })),
    });
  }

  return NextResponse.json({
    assigned: availableIds.length,
    skipped,
    message:
      skipped > 0
        ? `Assigned ${availableIds.length} asset(s). ${skipped} were not available and skipped.`
        : `Assigned ${availableIds.length} asset(s).`,
  });
}
