import type { SupabaseClient } from "@supabase/supabase-js";

/** Mark profile as Employee Portal–only so it does not appear on admin Users. */
export async function markUsersProfileEmployeePortalOnly(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;
  await supabase.from("users_profile").update({ employee_portal_only: true }).eq("id", userId);
}
