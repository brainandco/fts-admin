import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("tasks.create"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { title, region_id, created_by } = body;
  if (!title || !region_id) return NextResponse.json({ message: "title, region_id required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const createdBy = created_by || user?.id;
  if (!createdBy) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  const { data, error } = await supabase.from("tasks").insert({
    title: String(title).trim(),
    description: body.description || null,
    status: body.status || "Draft",
    priority: body.priority != null ? Number(body.priority) : 0,
    due_date: body.due_date || null,
    region_id,
    project_id: body.project_id || null,
    assigned_to_pm_id: body.assigned_to_pm_id || null,
    assigned_to_user_id: body.assigned_to_user_id || null,
    created_by: createdBy,
  }).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "task", entityId: data.id, newValue: body, description: "Task created" });
  return NextResponse.json(data);
}
