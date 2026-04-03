import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/public-env";

export async function POST(request: NextRequest) {
  const env = getSupabaseUrlAndAnonKey();
  if (!env) {
    return NextResponse.json({ error: "Server configuration" }, { status: 500 });
  }
  const res = NextResponse.json({ redirect: "/login" });
  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, mergeCookieOptions(request, options as { path?: string; maxAge?: number; secure?: boolean; sameSite?: "lax" | "strict" | "none" }))
          );
        },
      },
    }
  );
  await supabase.auth.signOut();
  return res;
}
