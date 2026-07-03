import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { parseImageUrlArray } from "@/lib/assets/resource-photos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await getDataClient();
  const userClient = await createServerSupabaseClient();

  const { data: existing } = await supabase.from("assets").select("id, is_ehs_tool").eq("id", id).maybeSingle();
  if (!existing?.is_ehs_tool) return NextResponse.json({ message: "EHS tool not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof body.condition === "string") updates.condition = body.condition.trim() || null;
  if (body.purchase_image_urls !== undefined) {
    updates.purchase_image_urls = parseImageUrlArray(body.purchase_image_urls);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No updates" }, { status: 400 });
  }

  const { error } = await userClient.from("assets").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await auditLog({
    actionType: "update",
    entityType: "asset",
    entityId: id,
    newValue: updates,
    description: "EHS tool updated",
  });

  return NextResponse.json({ ok: true });
}
