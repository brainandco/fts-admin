import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("projects.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, project_type, description } = body;
  if (!name || !project_type) return NextResponse.json({ message: "name and project_type required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("projects").insert({
    name: String(name).trim(),
    project_type: String(project_type).trim(),
    description: description || null,
  }).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "project", entityId: data.id, newValue: body, description: "Project created" });
  return NextResponse.json(data);
}
