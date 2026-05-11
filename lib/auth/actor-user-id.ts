import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Signed-in admin user id (users_profile / auth), for attribution columns. */
export async function getActorUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
