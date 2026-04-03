import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";

export async function GET() {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can manage permissions." }, { status: 403 });

  const supabase = await createServerSupabaseClient();
  const { data: permissions, error } = await supabase.from("permissions").select("id, code, name, module, created_at").order("module").order("code");
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(permissions ?? []);
}

export async function POST(req: Request) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Only Super User can create permissions." }, { status: 403 });

  const body = await req.json();
  const code = body.code?.trim();
  if (!code) return NextResponse.json({ message: "code is required" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: perm, error } = await supabase
    .from("permissions")
    .insert({ code, name: body.name?.trim() || null, module: body.module?.trim() || null })
    .select("id, code, name, module")
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json(perm);
}
