import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("teams.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id: teamId } = await params;
  const body = await req.json();
  const userId = body.userId;
  if (!userId) return NextResponse.json({ message: "userId required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId });
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await can("teams.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id: teamId } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ message: "userId required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
