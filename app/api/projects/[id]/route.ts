import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("projects.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.project_type !== undefined) updates.project_type = String(body.project_type).trim();
  if (body.description !== undefined) updates.description = body.description || null;
  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "project", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Project updated" });
  return NextResponse.json({ ok: true });
}
