import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { assertAssigneeAllowedInRegion } from "@/lib/admin-assignment/validate-assignee";
import { deleteReceiptForResource, upsertPendingReceipt } from "@/lib/resource-receipts";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await getDataClient();
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  const { data: old } = await supabase.from("sim_cards").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const meta: Record<string, unknown> = {};
  for (const k of ["operator", "service_type", "sim_number", "phone_number", "notes"] as const) {
    if (body[k] !== undefined) {
      meta[k] = typeof body[k] === "string" ? body[k].trim() || null : body[k];
    }
  }
  if (meta.service_type) {
    const allowed = new Set(["Data", "Voice", "Data+Voice"]);
    if (!allowed.has(String(meta.service_type))) {
      return NextResponse.json({ message: "service_type must be Data, Voice, or Data+Voice" }, { status: 400 });
    }
  }

  const assignInBody = body.assigned_to_employee_id !== undefined;
  const newAssignee = typeof body.assigned_to_employee_id === "string" ? body.assigned_to_employee_id.trim() : "";
  const doUnassign = body.unassign === true || (assignInBody && !newAssignee);

  if (doUnassign) {
    const { error } = await supabase
      .from("sim_cards")
      .update({
        status: "Available",
        assigned_to_employee_id: null,
        assigned_by_user_id: null,
        assigned_at: null,
        ...meta,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    await deleteReceiptForResource(supabase, "sim_card", id);
    await auditLog({
      actionType: "update",
      entityType: "sim_card",
      entityId: id,
      oldValue: old,
      newValue: { ...old, status: "Available", assigned_to_employee_id: null, ...meta },
      description: "SIM card unassigned",
    });
    return NextResponse.json({ ok: true });
  }

  if (assignInBody && newAssignee) {
    const regionForValidation =
      (typeof body.assignment_region_id === "string" && body.assignment_region_id.trim()) || null;
    if (!regionForValidation) {
      return NextResponse.json({ message: "assignment_region_id is required when assigning a SIM." }, { status: 400 });
    }
    if ((old as { status: string }).status !== "Available") {
      return NextResponse.json({ message: "SIM must be Available to assign." }, { status: 400 });
    }
    const check = await assertAssigneeAllowedInRegion(supabase, regionForValidation, "sim", newAssignee);
    if (!check.ok) return NextResponse.json({ message: check.message }, { status: 400 });
    const now = new Date().toISOString();
    const row = {
      status: "Assigned",
      assigned_to_employee_id: newAssignee,
      assigned_by_user_id: user?.id ?? null,
      assigned_at: now,
      ...meta,
    };
    const { error } = await supabase.from("sim_cards").update(row).eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    await supabase.from("sim_assignment_history").insert({
      sim_card_id: id,
      to_employee_id: newAssignee,
      assigned_by_user_id: user?.id ?? null,
      notes: typeof body.assignment_notes === "string" ? body.assignment_notes.trim() || null : null,
    });
    await upsertPendingReceipt(supabase, {
      employeeId: newAssignee,
      assignedByUserId: user?.id ?? null,
      resourceType: "sim_card",
      resourceId: id,
    });
    await auditLog({
      actionType: "update",
      entityType: "sim_card",
      entityId: id,
      oldValue: old,
      newValue: { ...old, ...row },
      description: "SIM card assigned",
    });
    return NextResponse.json({ ok: true });
  }

  if (Object.keys(meta).length === 0) {
    return NextResponse.json({ ok: true });
  }
  const { error } = await supabase.from("sim_cards").update(meta).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({
    actionType: "update",
    entityType: "sim_card",
    entityId: id,
    oldValue: old,
    newValue: { ...old, ...meta },
    description: "SIM card updated",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("sim_cards").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { error } = await supabase.from("sim_cards").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({ actionType: "delete", entityType: "sim_card", entityId: id, oldValue: old, description: "SIM card deleted" });
  return NextResponse.json({ ok: true });
}
