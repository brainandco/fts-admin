import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";

/** Same access as company documents: super user or approvals.approve. */
export async function gateSoftwareLibrary() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const okAdmin = await can("approvals.approve");
  if (!isSuper && !okAdmin) return { ok: false as const };
  return { ok: true as const, profile };
}
