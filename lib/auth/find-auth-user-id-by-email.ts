import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createServerSupabaseAdmin>;

const PER_PAGE = 200;
const MAX_PAGES = 50;

/**
 * Find auth user id by email via Admin API (paginated). Use when users_profile row is missing or mismatched.
 */
export async function findAuthUserIdByEmail(
  adminClient: AdminClient,
  emailRaw: string
): Promise<string | null> {
  const needle = (emailRaw ?? "").trim().toLowerCase();
  if (!needle) return null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error || !data?.users?.length) break;
    const hit = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === needle);
    if (hit?.id) return hit.id;
    if (data.users.length < PER_PAGE) break;
  }
  return null;
}

export function isAuthUserNotFoundMessage(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("not found") || m.includes("user not found") || m.includes("no user found");
}
