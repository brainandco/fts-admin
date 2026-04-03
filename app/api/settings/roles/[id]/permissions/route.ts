import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage role permissions." }, { status: 403 });

  const { id: roleId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: rows, error } = await supabase.from("role_permissions").select("permission_id").eq("role_id", roleId);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  const permission_ids = (rows ?? []).map((r) => r.permission_id);
  return NextResponse.json(permission_ids);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can assign permissions to roles." }, { status: 403 });

  const { id: roleId } = await params;
  const body = await req.json();
  const permission_ids = Array.isArray(body.permission_ids) ? body.permission_ids : [];
  const supabase = await createServerSupabaseClient();

  const { error: delErr } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
  if (delErr) return NextResponse.json({ message: delErr.message }, { status: 400 });

  if (permission_ids.length > 0) {
    const { error: insErr } = await supabase.from("role_permissions").insert(permission_ids.map((p: string) => ({ role_id: roleId, permission_id: p })));
    if (insErr) return NextResponse.json({ message: insErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
