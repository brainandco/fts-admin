import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { getUserDependencies } from "@/lib/user-dependencies";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase.from("users_profile").select("id").eq("id", id).single();
  if (!profile) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const dependencies = await getUserDependencies(supabase, id);
  return NextResponse.json(dependencies);
}
