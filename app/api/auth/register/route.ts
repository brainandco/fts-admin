import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/public-env";

/**
 * Server-side registration: sign up with Supabase Auth and create users_profile
 * in the same request so the session is set and profile is stored reliably.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; full_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const env = getSupabaseUrlAndAnonKey();
  if (!env) {
    return NextResponse.json({ error: "Server configuration" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" } }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, mergeCookieOptions(request, options))
          );
        },
      },
    }
  );

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || undefined } },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "Sign up failed" }, { status: 400 });
  }

  if (!authData.session) {
    return NextResponse.json({ ok: true, signInRequired: true });
  }

  const { error: insertError } = await supabase.from("users_profile").upsert(
    {
      id: user.id,
      email: user.email ?? email,
      full_name: fullName || null,
      status: "ACTIVE",
      invitation_accepted_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (insertError) {
    if (insertError.code === "23505") {
      return res;
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return res;
}
