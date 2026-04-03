import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("tasks.edit"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id: taskId } = await params;
  const body = await req.json();
  const commentBody = body.body;
  if (!commentBody || typeof commentBody !== "string") return NextResponse.json({ message: "body required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, user_id: user.id, body: commentBody.trim() });
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
