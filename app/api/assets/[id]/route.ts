import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { deleteReceiptForResource, upsertPendingReceipt } from "@/lib/resource-receipts";
import { assertAssigneeAllowedInRegion, resolveAssetAssignmentRegion } from "@/lib/admin-assignment/validate-assignee";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";
import { assetIdentifierConflictMessage } from "@/lib/data-uniqueness";
import { formatCompanyDisplayName } from "@/lib/assets/company-display";
import { categoryGroupsByCompany } from "@/lib/assets/asset-id-scheme";

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
  if (body.purchase_image_urls !== undefined) {
    updates.purchase_image_urls = parseImageUrlArray(body.purchase_image_urls);
  }
  const newEmployeeId = body.assigned_to_employee_id?.trim() || null;
  if (body.assigned_to_employee_id !== undefined) {
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (newEmployeeId) {
      let regionForValidation =
        (typeof body.assignment_region_id === "string" && body.assignment_region_id.trim()) ||
        (old as { assigned_region_id?: string | null }).assigned_region_id ||
        null;
      if (!regionForValidation) {
        const resolved = await resolveAssetAssignmentRegion(supabase, newEmployeeId);
        if (!resolved.ok) return NextResponse.json({ message: resolved.message }, { status: 400 });
        regionForValidation = resolved.regionId;
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

  const oldRow = old as { category?: string; specs?: unknown };
  const mergedCategory =
    updates.category !== undefined ? String(updates.category).trim() : String(oldRow.category ?? "").trim();
  const usesCompanyName = categoryGroupsByCompany(mergedCategory);

  if (updates.specs !== undefined && updates.specs && typeof updates.specs === "object" && !Array.isArray(updates.specs)) {
    const nextSpecs = { ...(updates.specs as Record<string, unknown>) };
    if (typeof nextSpecs.company === "string" && nextSpecs.company.trim()) {
      nextSpecs.company = formatCompanyDisplayName(nextSpecs.company.trim());
    }
    updates.specs = nextSpecs;
    if (usesCompanyName && typeof nextSpecs.company === "string" && nextSpecs.company.trim()) {
      updates.name = nextSpecs.company.trim();
    }
  } else if (usesCompanyName && updates.name !== undefined && typeof updates.name === "string") {
    const formatted = formatCompanyDisplayName(updates.name.trim());
    updates.name = formatted;
    const prev =
      oldRow.specs && typeof oldRow.specs === "object" && !Array.isArray(oldRow.specs)
        ? { ...(oldRow.specs as Record<string, unknown>) }
        : {};
    prev.company = formatted;
    updates.specs = prev;
  }

  const touchesId =
    updates.serial !== undefined ||
    updates.asset_id !== undefined ||
    updates.imei_1 !== undefined ||
    updates.imei_2 !== undefined;
  if (touchesId) {
    const o = old as {
      serial?: string | null;
      asset_id?: string | null;
      imei_1?: string | null;
      imei_2?: string | null;
    };
    const pick = (u: unknown, fallback: string | null | undefined) => {
      if (u !== undefined) return typeof u === "string" ? u.trim() || null : null;
      return typeof fallback === "string" ? fallback.trim() || null : null;
    };
    const idMsg = await assetIdentifierConflictMessage(
      supabase,
      {
        serial: pick(updates.serial, o.serial),
        asset_id: pick(updates.asset_id, o.asset_id),
        imei_1: pick(updates.imei_1, o.imei_1),
        imei_2: pick(updates.imei_2, o.imei_2),
      },
      id
    );
    if (idMsg) return NextResponse.json({ message: idMsg }, { status: 400 });
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

  await deleteReceiptForResource(supabase, "asset", id);

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({ actionType: "delete", entityType: "asset", entityId: id, oldValue: old, description: "Asset deleted" });
  return NextResponse.json({ ok: true });
}
