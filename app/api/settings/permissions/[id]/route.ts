import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage permissions." }, { status: 403 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: perm, error } = await supabase.from("permissions").select("id, code, name, module, created_at").eq("id", id).single();
  if (error || !perm) return NextResponse.json({ message: "Permission not found" }, { status: 404 });
  return NextResponse.json(perm);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can update permissions." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const updates: { code?: string; name?: string | null; module?: string | null } = {};
  if (body.code !== undefined) updates.code = body.code?.trim() || body.code;
  if (body.name !== undefined) updates.name = body.name?.trim() || null;
  if (body.module !== undefined) updates.module = body.module?.trim() || null;
  if (Object.keys(updates).length === 0) return NextResponse.json({ message: "No updates provided" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: perm, error } = await supabase.from("permissions").update(updates).eq("id", id).select("id, code, name, module").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(perm);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can delete permissions." }, { status: 403 });

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("permissions").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
