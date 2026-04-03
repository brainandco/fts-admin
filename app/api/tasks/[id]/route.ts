import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("tasks.edit"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const supabase = await createServerSupabaseClient();
  const { data: old } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (!old) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const updates: Record<string, unknown> = {};
  const keys = ["title", "description", "status", "priority", "due_date", "region_id", "project_id", "assigned_to_pm_id", "assigned_to_user_id"];
  keys.forEach((k) => { if (body[k] !== undefined) updates[k] = body[k]; });
  if (updates.status && ["Closed", "Completed", "Verified"].includes(updates.status as string)) {
    updates.closed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("tasks").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "update", entityType: "task", entityId: id, oldValue: old, newValue: { ...old, ...updates }, description: "Task updated" });
  return NextResponse.json({ ok: true });
}
