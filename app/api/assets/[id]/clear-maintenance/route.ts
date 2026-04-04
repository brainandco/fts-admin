import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { deleteReceiptForResource } from "@/lib/resource-receipts";

/** Admin: set asset from Under_Maintenance → Available (back in pool) after repair. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const { data: asset, error: fetchErr } = await supabase.from("assets").select("*").eq("id", id).single();

  if (fetchErr || !asset) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (asset.status !== "Under_Maintenance") {
    return NextResponse.json(
      { message: "Only assets currently under maintenance can be marked back in pool." },
      { status: 400 }
    );
  }

  const updates = {
    status: "Available" as const,
    assigned_to_employee_id: null as null,
    assigned_by: null as null,
    assigned_at: null as null,
  };

  const { error: updErr } = await supabase.from("assets").update(updates).eq("id", id);
  if (updErr) {
    return NextResponse.json({ message: updErr.message }, { status: 400 });
  }

  await deleteReceiptForResource(supabase, "asset", id);

  await auditLog({
    actionType: "update",
    entityType: "asset",
    entityId: id,
    oldValue: asset as unknown as Record<string, unknown>,
    newValue: { ...asset, ...updates },
    description: "Maintenance complete: asset marked Available (admin)",
  });

  return NextResponse.json({ ok: true });
}
