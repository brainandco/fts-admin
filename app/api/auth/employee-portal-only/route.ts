import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/public-env";

/**
 * Employees (any role) use the Employee Portal only and cannot access the admin panel.
 * This route signs them out from the admin portal and redirects to login with a message.
 */
export async function GET(request: NextRequest) {
  const env = getSupabaseUrlAndAnonKey();
  if (!env) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const res = NextResponse.redirect(
    new URL("/login?error=" + encodeURIComponent("Use the Employee Portal to sign in. Admin panel is for users only."), request.url)
  );
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
