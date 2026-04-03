import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";

export async function GET() {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage roles." }, { status: 403 });

  const supabase = await createServerSupabaseClient();
  const { data: roles, error } = await supabase.from("roles").select("id, name, description, created_at").order("name");
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(roles ?? []);
}

export async function POST(req: Request) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can create roles." }, { status: 403 });

  const body = await req.json();
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ message: "name is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: role, error } = await supabase.from("roles").insert({ name, description: body.description?.trim() || null }).select("id, name, description").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(role);
}
