import type { SupabaseClient } from "@supabase/supabase-js";

/** Emails that exist on `employees` (normalized lowercase). */
export async function getEmployeeEmailSet(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data } = await supabase.from("employees").select("email");
  return new Set(
    (data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean)
  );
}

/**
 * Admin portal accounts: `users_profile` rows whose email is not on `employees`.
 * Optionally restrict by status (e.g. ACTIVE to match dashboard "Admin users").
 */
export function countAdminPortalProfiles(
  profiles: { email: string | null; status: string }[],
  employeeEmails: Set<string>,
  status?: string
): number {
  return profiles.filter((p) => {
    const em = (p.email ?? "").toLowerCase().trim();
    if (!em || employeeEmails.has(em)) return false;
    if (status && p.status !== status) return false;
    return true;
  }).length;
}

/** Active admin portal users — same meaning as dashboard "Admin users" card. */
export async function countActiveAdminPortalUsers(
  supabase: SupabaseClient
): Promise<number> {
  const [empSet, profilesRes] = await Promise.all([
    getEmployeeEmailSet(supabase),
    supabase.from("users_profile").select("email, status").eq("status", "ACTIVE"),
  ]);
  const profiles = profilesRes.data ?? [];
  return countAdminPortalProfiles(profiles, empSet, "ACTIVE");
}
