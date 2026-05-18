import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getEmployeePortalBaseUrl } from "@/lib/email/employee-portal-base-url";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/public-env";

/**
 * Employees must use the Employee Portal only. Sign out from the admin session and send them to the employee app.
 */
export async function GET(request: NextRequest) {
  const employeeBase = getEmployeePortalBaseUrl();
  const message =
    "Use the Employee Portal to sign in. The Admin Portal is for office administrators only.";
  const target = new URL("/login", employeeBase);
  target.searchParams.set("error", message);

  const env = getSupabaseUrlAndAnonKey();
  if (!env) {
    return NextResponse.redirect(target, 302);
  }

  const res = NextResponse.redirect(target, 302);
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(
            name,
            value,
            mergeCookieOptions(request, options as { path?: string; maxAge?: number; secure?: boolean; sameSite?: "lax" | "strict" | "none" })
          )
        );
      },
    },
  });
  await supabase.auth.signOut();
  return res;
}
