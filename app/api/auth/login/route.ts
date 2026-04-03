import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

/** Only allow same-origin path redirects (e.g. /dashboard). */
function safeRedirectTo(raw: string, baseUrl: string): string {
  const s = (raw || "").trim() || "/dashboard";
  if (!s.startsWith("/") || s.startsWith("//")) return "/dashboard";
  try {
    const u = new URL(s, baseUrl);
    if (u.origin !== new URL(baseUrl).origin) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = (formData.get("email") as string) || "";
  const password = (formData.get("password") as string) || "";
  const redirectTo = safeRedirectTo((formData.get("redirectTo") as string) || "/dashboard", request.url);
  const wantsJson = request.headers.get("accept")?.includes("application/json");

  const loginUrl = new URL("/login", request.url);
  const addRedirect = (url: URL) => {
    url.searchParams.set("redirect", redirectTo);
    return url;
  };

  if (!email?.trim() || !password) {
    if (wantsJson) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    addRedirect(loginUrl);
    loginUrl.searchParams.set("error", "Email and password required");
    return NextResponse.redirect(loginUrl, 302);
  }

  const destination = new URL(redirectTo, request.url);
  const redirectResponse = NextResponse.redirect(destination, { status: 303 });
  const jsonResponse = NextResponse.json({ ok: true, redirectTo });
  const responseToUse = wantsJson ? jsonResponse : redirectResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none" } }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseToUse.cookies.set(name, value, mergeCookieOptions(request, options))
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (wantsJson) return NextResponse.json({ error: error.message }, { status: 401 });
    addRedirect(loginUrl);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl, 302);
  }

  await supabase.auth.getSession();
  return responseToUse;
}
