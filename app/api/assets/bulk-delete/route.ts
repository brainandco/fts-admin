import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";

const MAX_IDS = 200;

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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
