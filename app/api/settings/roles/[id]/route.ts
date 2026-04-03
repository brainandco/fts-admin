import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage roles." }, { status: 403 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: role, error } = await supabase.from("roles").select("id, name, description, created_at").eq("id", id).single();
  if (error || !role) return NextResponse.json({ message: "Role not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can update roles." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const updates: { name?: string; description?: string | null } = {};
  if (body.name !== undefined) updates.name = body.name?.trim() || body.name;
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (Object.keys(updates).length === 0) return NextResponse.json({ message: "No updates provided" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: role, error } = await supabase.from("roles").update(updates).eq("id", id).select("id, name, description").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(role);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can delete roles." }, { status: 403 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
