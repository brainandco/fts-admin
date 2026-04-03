import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ redirect: "/login" });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
