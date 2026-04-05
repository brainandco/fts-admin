import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { deleteReceiptForResource, upsertPendingReceipt } from "@/lib/resource-receipts";
import { assertAssigneeAllowedInRegion } from "@/lib/admin-assignment/validate-assignee";
import { hasMinimumPhotos, parseImageUrlArray } from "@/lib/assets/resource-photos";

const ASSET_ASSIGNMENT_KEYS = new Set(["assigned_to_employee_id", "assignment_region_id", "assignment_notes"]);

/** PM assigns assets to employees; admin updates details only. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("assets").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const patchKeys = Object.keys(body).filter((k) => body[k as string] !== undefined);
  if (patchKeys.length === 0) {
    return NextResponse.json({ ok: true });
  }

  /* Status is controlled by assignment, returns workflow, and create — not free-form edits here. */
  const keys = ["asset_id", "name", "category", "serial", "condition", "specs"];
  const updates: Record<string, unknown> = {};
  keys.forEach((k) => {
    if (body[k] !== undefined) updates[k] = body[k];
  });
  if (body.assigned_region_id !== undefined) {
    updates.assigned_region_id =
      typeof body.assigned_region_id === "string" && body.assigned_region_id.trim()
        ? body.assigned_region_id.trim()
        : null;
  }
  if (body.software_connectivity !== undefined) {
    updates.software_connectivity = typeof body.software_connectivity === "string" ? body.software_connectivity.trim() || null : null;
  }
  for (const k of ["imei_1", "imei_2", "model"] as const) {
    if (body[k] !== undefined) {
      updates[k] = typeof body[k] === "string" ? body[k].trim() || null : null;
    }
  }
  const assignmentOnly = patchKeys.every((k) => ASSET_ASSIGNMENT_KEYS.has(k));
  if (!assignmentOnly) {
    const merged =
      body.purchase_image_urls !== undefined
        ? parseImageUrlArray(body.purchase_image_urls)
        : parseImageUrlArray((old as { purchase_image_urls?: unknown }).purchase_image_urls);
    if (!hasMinimumPhotos(merged)) {
      return NextResponse.json(
        { message: "At least 2 intake condition photos are required. Add them in the asset form before saving other changes." },
        { status: 400 }
      );
    }
  }
  if (body.purchase_image_urls !== undefined) {
    updates.purchase_image_urls = parseImageUrlArray(body.purchase_image_urls);
  }
  const newEmployeeId = body.assigned_to_employee_id?.trim() || null;
  if (body.assigned_to_employee_id !== undefined) {
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (newEmployeeId) {
      const regionForValidation =
        (typeof body.assignment_region_id === "string" && body.assignment_region_id.trim()) ||
        (old as { assigned_region_id?: string | null }).assigned_region_id ||
        null;
      if (!regionForValidation) {
        return NextResponse.json(
          { message: "Set a regional pool on the asset or send assignment_region_id when assigning." },
          { status: 400 }
        );
      }
      const check = await assertAssigneeAllowedInRegion(supabase, regionForValidation, "asset", newEmployeeId);
      if (!check.ok) return NextResponse.json({ message: check.message }, { status: 400 });
      updates.assigned_region_id = regionForValidation;
      updates.assigned_to_employee_id = newEmployeeId;
      updates.status = "Assigned";
      updates.assigned_by = user?.id ?? null;
      updates.assigned_at = new Date().toISOString();
    } else {
      updates.assigned_to_employee_id = null;
      updates.assigned_by = null;
      updates.assigned_at = null;
      updates.status = "Available";
    }
  }
  const { error } = await supabase.from("assets").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  if (body.assigned_to_employee_id !== undefined) {
    const oldEmp = (old as { assigned_to_employee_id?: string | null }).assigned_to_employee_id ?? null;
    const assigneeChanged = oldEmp !== newEmployeeId;
    if (assigneeChanged) {
      const userClient = await createServerSupabaseClient();
      const { data: { user } } = await userClient.auth.getUser();
      if (newEmployeeId) {
        await upsertPendingReceipt(supabase, {
          employeeId: newEmployeeId,
          assignedByUserId: user?.id ?? null,
          resourceType: "asset",
          resourceId: id,
        });
      } else {
        await deleteReceiptForResource(supabase, "asset", id);
      }
    }
  }

  if (newEmployeeId && (old as { assigned_to_employee_id?: string }).assigned_to_employee_id !== newEmployeeId) {
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user?.id) {
      await supabase.from("asset_assignment_history").insert({
        asset_id: id,
        to_employee_id: newEmployeeId,
        assigned_by_user_id: user.id,
        notes: body.assignment_notes || null,
      });
    }
  }
  await auditLog({ actionType: "update", entityType: "asset", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Asset updated" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: old } = await supabase.from("assets").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({ actionType: "delete", entityType: "asset", entityId: id, oldValue: old, description: "Asset deleted" });
  return NextResponse.json({ ok: true });
}
