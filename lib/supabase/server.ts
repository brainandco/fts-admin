import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseUrlAndAnonKey } from "@/lib/supabase/public-env";

export async function createServerSupabaseClient() {
  const env = getSupabaseUrlAndAnonKey();
  if (!env) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }
  const cookieStore = await cookies();
  return createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { path: "/", ...(options as object) })
            );
          } catch {
            // ignore in Server Components
          }
        },
      },
    }
  );
}

/**
 * Use for admin portal data reads (employees, assets, regions, etc.).
 * Bypasses RLS so data shows regardless of policy; permission checks are done in app via can().
 * Falls back to user client if service role key is not set (e.g. some dev setups).
 */
export async function getDataClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServerSupabaseAdmin();
  }
  return createServerSupabaseClient();
}
