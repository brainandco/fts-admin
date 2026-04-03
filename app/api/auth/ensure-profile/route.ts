import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function safeNext(next: string | null, baseUrl: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  try {
    const u = new URL(next, baseUrl);
    return u.origin === new URL(baseUrl).origin ? next : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

async function ensureProfile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, promoted: false, error: null as string | null };
  const fullName = (user.user_metadata?.full_name as string) ?? "";
  const email = user.email ?? "";
  const { data: existing } = await supabase.from("users_profile").select("id").eq("id", user.id).single();

  if (!existing) {
    const { error: insertErr } = await supabase.from("users_profile").insert({
      id: user.id,
      email,
      full_name: fullName || null,
      status: "ACTIVE",
    });
    if (insertErr && insertErr.code !== "23505") return { user, promoted: false, error: insertErr.message };
  }
  return { user, promoted: false, error: null };
}

/** POST: ensure profile exists. Returns JSON. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const result = await ensureProfile(supabase);
  if (!result.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, promoted: result.promoted });
}

/**
 * GET: Create users_profile row if the current user has none (fallback when DB trigger didn't run).
 * Dashboard redirects here when no_profile; this creates the row and redirects back to dashboard.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const result = await ensureProfile(supabase);
  const next = safeNext(request.nextUrl.searchParams.get("next"), request.url);
  if (!result.user) {
    return NextResponse.redirect(new URL("/login?redirect=" + encodeURIComponent(next), request.url), 302);
  }
  return NextResponse.redirect(new URL(next, request.url), 302);
}
