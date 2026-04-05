import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
const MAX_IDS = 500;

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as {
    ids?: unknown;
    deleteAll?: unknown;
    confirm?: unknown;
  };

  const supabase = await getDataClient();

  /** Remove every asset row (assigned or not). Receipt rows must go first — no FK to assets. */
  if (body.deleteAll === true) {
    if (body.confirm !== "DELETE_ALL_ASSETS") {
      return NextResponse.json(
        { message: 'To delete every asset, send confirm: "DELETE_ALL_ASSETS" in the JSON body.' },
        { status: 400 }
      );
    }
    const { data: rows, error: listErr } = await supabase.from("assets").select("id");
    if (listErr) return NextResponse.json({ message: listErr.message }, { status: 400 });
    const allIds = (rows ?? []).map((r) => r.id as string);
    const { error: recErr } = await supabase.from("resource_receipt_confirmations").delete().eq("resource_type", "asset");
    if (recErr) return NextResponse.json({ message: recErr.message }, { status: 400 });

    let deletedCount = 0;
    const chunk = 200;
    for (let i = 0; i < allIds.length; i += chunk) {
      const part = allIds.slice(i, i + chunk);
      if (part.length === 0) continue;
      const { error: delErr } = await supabase.from("assets").delete().in("id", part);
      if (delErr) return NextResponse.json({ message: delErr.message }, { status: 400 });
      deletedCount += part.length;
    }

    await auditLog({
      actionType: "delete",
      entityType: "asset",
      entityId: null,
      description: `All assets deleted (${deletedCount} row(s)).`,
      meta: { deleteAll: true },
    });

    return NextResponse.json({
      deletedCount,
      failedCount: 0,
      deleted: allIds,
      failed: [] as { id: string; message: string }[],
      deleteAll: true,
    });
  }

  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ message: "Request body must include a non-empty ids array, or deleteAll: true." }, { status: 400 });
  }

  const ids = [...new Set(raw.map((id: unknown) => String(id).trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ message: "No valid ids." }, { status: 400 });

  const deleted: string[] = [];
  const failed: { id: string; message: string }[] = [];

  const { error: recBatchErr } = await supabase
    .from("resource_receipt_confirmations")
    .delete()
    .eq("resource_type", "asset")
    .in("resource_id", ids);
  if (recBatchErr) {
    return NextResponse.json({ message: recBatchErr.message }, { status: 400 });
  }

  for (const id of ids) {
    const { data: old } = await supabase.from("assets").select("*").eq("id", id).single();
    if (!old) {
      failed.push({ id, message: "Not found" });
      continue;
    }
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) {
      failed.push({ id, message: error.message });
      continue;
    }
    await auditLog({ actionType: "delete", entityType: "asset", entityId: id, oldValue: old, description: "Asset deleted (bulk)" });
    deleted.push(id);
  }

  return NextResponse.json({
    deletedCount: deleted.length,
    failedCount: failed.length,
    deleted,
    failed,
  });
}
