import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("regions.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { name, code } = body;
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("regions").select("name, code").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const updates: { name?: string; code?: string | null } = {};
  if (typeof name === "string") updates.name = name.trim();
  if (code !== undefined) updates.code = code === "" ? null : code;
  const { error } = await supabase.from("regions").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "region", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Region updated" });
  return NextResponse.json({ ok: true });
}
