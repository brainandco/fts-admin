import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";

async function canManageDelegation(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, delegationId: string, userId: string) {
  const { data: d } = await supabase.from("delegations").select("delegator_user_id").eq("id", delegationId).single();
  if (!d) return { allowed: false, notFound: true };
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user ?? false;
  if (isSuper || d.delegator_user_id === userId) return { allowed: true, notFound: false };
  return { allowed: false, notFound: false };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const check = await canManageDelegation(supabase, id, user.id);
  if (check.notFound) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!check.allowed) return NextResponse.json({ message: "Only the delegator or Super User can update this delegation" }, { status: 403 });
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.from_date !== undefined) updates.from_date = body.from_date;
  if (body.to_date !== undefined) updates.to_date = body.to_date;
  if (body.notes !== undefined) updates.notes = body.notes;
  const { error } = await supabase.from("delegations").update(updates).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const check = await canManageDelegation(supabase, id, user.id);
  if (check.notFound) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!check.allowed) return NextResponse.json({ message: "Only the delegator or Super User can delete this delegation" }, { status: 403 });
  const { error } = await supabase.from("delegations").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
