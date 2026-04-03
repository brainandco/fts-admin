import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireActive } from "@/lib/rbac/permissions";

/** PATCH: update own admin profile (display name). */
export async function PATCH(request: NextRequest) {
  const access = await requireActive();
  if (!access.allowed || !access.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { full_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const full_name =
    typeof body.full_name === "string" ? body.full_name.trim() || null : null;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("users_profile")
    .update({ full_name })
    .eq("id", access.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
