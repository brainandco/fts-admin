import { NextResponse } from "next/server";
import { can, PERMISSION_BULK_DELETE } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { deleteReceiptForResource } from "@/lib/resource-receipts";

const MAX_IDS = 500;

const BULK_DELETE_DENIED =
  'Bulk delete is not enabled for your account. A Super User must grant the "Execute bulk deletes" permission to your role.';

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  if (!(await can(PERMISSION_BULK_DELETE))) {
    return NextResponse.json({ message: BULK_DELETE_DENIED }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ message: "Request body must include a non-empty ids array." }, { status: 400 });
  }

  const ids = [...new Set(raw.map((id: unknown) => String(id).trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ message: "No valid ids." }, { status: 400 });

  const supabase = await getDataClient();
  const deleted: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { data: vehicle } = await supabase.from("vehicles").select("*").eq("id", id).single();
    if (!vehicle) {
      failed.push({ id, message: "Not found" });
      continue;
    }
    await deleteReceiptForResource(supabase, "vehicle", id);
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) {
      failed.push({ id, message: error.message });
      continue;
    }
    await auditLog({ actionType: "delete", entityType: "vehicle", entityId: id, oldValue: vehicle, description: "Vehicle deleted (bulk)" });
    deleted.push(id);
  }

  return NextResponse.json({
    deletedCount: deleted.length,
    failedCount: failed.length,
    deleted,
    failed,
  });
}
