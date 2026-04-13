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
  profiles: { email: string | null; status: string; employee_portal_only?: boolean | null }[],
  employeeEmails: Set<string>,
  status?: string
): number {
  return profiles.filter((p) => {
    const em = (p.email ?? "").toLowerCase().trim();
    if (!em || employeeEmails.has(em)) return false;
    if (p.employee_portal_only === true) return false;
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
    supabase.from("users_profile").select("email, status, employee_portal_only").eq("status", "ACTIVE"),
  ]);
  const profiles = profilesRes.data ?? [];
  return countAdminPortalProfiles(profiles, empSet, "ACTIVE");
}

/** All employee roster rows (any status). */
export async function countAllEmployees(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("employees").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/**
 * Cumulative FTS headcount: everyone on the employee roster plus active admin-portal-only
 * accounts (profiles whose email is not on `employees`). No double-count.
 */
export async function getTotalFtsPeopleCount(supabase: SupabaseClient): Promise<number> {
  const [roster, adminOnly] = await Promise.all([
    countAllEmployees(supabase),
    countActiveAdminPortalUsers(supabase),
  ]);
  return roster + adminOnly;
}
