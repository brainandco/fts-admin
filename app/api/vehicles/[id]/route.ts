import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { assertAssigneeAllowedForRegionTeam } from "@/lib/admin-assignment/validate-assignee";
import { deleteReceiptForResource, upsertPendingReceipt } from "@/lib/resource-receipts";

const VEHICLE_KEYS = [
  "plate_number", "vehicle_type", "rent_company", "make", "model", "assignment_type", "status",
];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await getDataClient();
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  const { data: old } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (body.unassign === true) {
    await supabase.from("vehicle_assignments").delete().eq("vehicle_id", id);
    const { error } = await supabase
      .from("vehicles")
      .update({
        status: "Available",
        assigned_region_id: null,
        assigned_by: null,
        assigned_at: null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    await deleteReceiptForResource(supabase, "vehicle", id);
    await auditLog({
      actionType: "update",
      entityType: "vehicle",
      entityId: id,
      oldValue: old,
      newValue: { ...old, status: "Available", assigned_region_id: null },
      description: "Vehicle unassigned",
    });
    return NextResponse.json({ ok: true });
  }

  const employeeIdRaw = body.employee_id;
  if (employeeIdRaw != null && String(employeeIdRaw).trim() !== "") {
    const employeeId = String(employeeIdRaw).trim();
    if ((old as { status: string }).status !== "Available") {
      return NextResponse.json({ message: "Vehicle must be Available to assign." }, { status: 400 });
    }
    const { data: existingVa } = await supabase.from("vehicle_assignments").select("vehicle_id").eq("vehicle_id", id).maybeSingle();
    if (existingVa) {
      return NextResponse.json({ message: "Vehicle already has an assignee. Unassign first." }, { status: 400 });
    }
    const regionForValidation =
      (typeof body.assignment_region_id === "string" && body.assignment_region_id.trim()) ||
      (old as { assigned_region_id?: string | null }).assigned_region_id ||
      null;
    if (!regionForValidation) {
      return NextResponse.json(
        { message: "Set a regional pool on the vehicle or send assignment_region_id when assigning." },
        { status: 400 }
      );
    }
    const targetTeamId =
      typeof body.target_team_id === "string" && body.target_team_id.trim() ? body.target_team_id.trim() : null;
    const check = await assertAssigneeAllowedForRegionTeam(supabase, regionForValidation, "vehicle", employeeId, targetTeamId);
    if (!check.ok) return NextResponse.json({ message: check.message }, { status: 400 });

    const { data: toEmployee } = await supabase.from("employees").select("id, region_id").eq("id", employeeId).maybeSingle();
    if (!toEmployee) return NextResponse.json({ message: "Employee not found" }, { status: 400 });

    const { error: insErr } = await supabase.from("vehicle_assignments").insert({
      vehicle_id: id,
      employee_id: employeeId,
    });
    if (insErr) return NextResponse.json({ message: insErr.message }, { status: 400 });

    const now = new Date().toISOString();
    const assignedRegionId =
      toEmployee.region_id ??
      (old as { assigned_region_id?: string | null }).assigned_region_id ??
      regionForValidation;
    const { error: upErr } = await supabase
      .from("vehicles")
      .update({
        status: "Assigned",
        assigned_region_id: assignedRegionId,
        assigned_by: user?.id ?? null,
        assigned_at: now,
      })
      .eq("id", id);
    if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });

    await upsertPendingReceipt(supabase, {
      employeeId,
      assignedByUserId: user?.id ?? null,
      resourceType: "vehicle",
      resourceId: id,
    });
    await auditLog({
      actionType: "update",
      entityType: "vehicle",
      entityId: id,
      oldValue: old,
      newValue: { ...old, status: "Assigned", assigned_region_id: assignedRegionId },
      description: "Vehicle assigned",
    });
    return NextResponse.json({ ok: true });
  }

  const updates: Record<string, unknown> = {};
  VEHICLE_KEYS.forEach((k) => {
    if (body[k] !== undefined) updates[k] = body[k] === "" ? null : body[k];
  });
  if (updates.plate_number !== undefined && typeof updates.plate_number === "string" && !String(updates.plate_number).trim()) {
    return NextResponse.json({ message: "Vehicle plate number is required" }, { status: 400 });
  }
  if (updates.assignment_type !== undefined && !["Temporary", "Permanent"].includes(String(updates.assignment_type))) {
    return NextResponse.json({ message: "assignment_type must be Temporary or Permanent" }, { status: 400 });
  }
  if (body.assigned_region_id !== undefined) {
    updates.assigned_region_id =
      typeof body.assigned_region_id === "string" && body.assigned_region_id.trim()
        ? body.assigned_region_id.trim()
        : null;
  }
  const { error } = await supabase.from("vehicles").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "vehicle", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Vehicle updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();
  if (!vehicle) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "delete", entityType: "vehicle", entityId: id, oldValue: vehicle, description: "Vehicle deleted" });
  return NextResponse.json({ ok: true });
}
