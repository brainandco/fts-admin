import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UsersProfile } from "@/lib/types/database";

/** Super role id (must match supabase/seed_super_role.sql). */
const SUPER_ROLE_ID = "a0000000-0000-0000-0000-000000000000";

/** Role id for "Regional Project Manager" – not assignable to users; PM is an employee role only (region/project on employee). */
export const REGIONAL_PM_ROLE_ID = "a0000000-0000-0000-0000-000000000002";

export async function getCurrentUserProfile() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("users_profile")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { user, profile: null };
  return { user, profile: { ...profile, region_id: null } };
}

export async function getCurrentUserRolesAndPermissions() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { permissions: new Set<string>(), roleIds: new Set<string>() };

  const profile = await supabase
    .from("users_profile")
    .select("is_super_user")
    .eq("id", user.id)
    .single();

  if (profile.data?.is_super_user) {
    return { permissions: new Set<string>(["*"]), roleIds: new Set<string>(), isSuper: true };
  }

  const { data: superRole } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("role_id", SUPER_ROLE_ID)
    .maybeSingle();

  if (superRole) {
    return { permissions: new Set<string>(["*"]), roleIds: new Set<string>(), isSuper: true };
  }

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id);
  const roleIds = new Set((userRoles ?? []).map((r) => r.role_id));

  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", Array.from(roleIds));
  const permIds = [...new Set((rolePerms ?? []).map((p) => p.permission_id))];

  const { data: perms } = await supabase
    .from("permissions")
    .select("code")
    .in("id", permIds);
  const fromRoles = new Set((perms ?? []).map((p) => p.code));

  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("permission_id, granted")
    .eq("user_id", user.id);
  const overridePermIds = (overrides ?? []).filter((o) => o.granted).map((o) => o.permission_id);
  const denyPermIds = (overrides ?? []).filter((o) => !o.granted).map((o) => o.permission_id);

  const { data: overridePerms } = overridePermIds.length
    ? await supabase.from("permissions").select("code").in("id", overridePermIds)
    : { data: [] };
  const { data: denyPerms } = denyPermIds.length
    ? await supabase.from("permissions").select("code").in("id", denyPermIds)
    : { data: [] };

  const granted = new Set([...fromRoles, ...(overridePerms ?? []).map((p) => p.code)]);
  (denyPerms ?? []).forEach((p) => granted.delete(p.code));

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeDelegations } = await supabase
    .from("delegations")
    .select("delegator_user_id")
    .eq("delegatee_user_id", user.id)
    .lte("from_date", today)
    .gte("to_date", today);
  if (activeDelegations?.length) {
    const delegatorIds = [...new Set(activeDelegations.map((d) => d.delegator_user_id))];
    for (const delegatorId of delegatorIds) {
      const { data: dr } = await supabase.from("user_roles").select("role_id").eq("user_id", delegatorId);
      const dRoleIds = (dr ?? []).map((r) => r.role_id);
      const { data: drp } = await supabase.from("role_permissions").select("permission_id").in("role_id", dRoleIds);
      const dPermIds = [...new Set((drp ?? []).map((p) => p.permission_id))];
      const { data: dp } = dPermIds.length ? await supabase.from("permissions").select("code").in("id", dPermIds) : { data: [] };
      (dp ?? []).forEach((p) => granted.add(p.code));
      const { data: dOverrides } = await supabase.from("user_permission_overrides").select("permission_id, granted").eq("user_id", delegatorId);
      const dGrantedIds = (dOverrides ?? []).filter((o) => o.granted).map((o) => o.permission_id);
      const dDenyIds = (dOverrides ?? []).filter((o) => !o.granted).map((o) => o.permission_id);
      if (dGrantedIds.length) {
        const { data: dgp } = await supabase.from("permissions").select("code").in("id", dGrantedIds);
        (dgp ?? []).forEach((p) => granted.add(p.code));
      }
      if (dDenyIds.length) {
        const { data: ddp } = await supabase.from("permissions").select("code").in("id", dDenyIds);
        (ddp ?? []).forEach((p) => granted.delete(p.code));
      }
    }
  }

  return { permissions: granted, roleIds, isSuper: false };
}

export async function can(permissionCode: string): Promise<boolean> {
  // Use same access check as dashboard layout so super user is allowed consistently
  const access = await requireActive();
  if (access.allowed && access.profile?.is_super_user) return true;
  if (!access.allowed) return false;

  const { profile } = await getCurrentUserProfile();
  if (!profile) return false;
  if (profile.is_super_user) return true;
  const { permissions } = await getCurrentUserRolesAndPermissions();
  return permissions.has("*") || permissions.has(permissionCode);
}

/**
 * Dashboard access: must be logged in, have a users_profile row, and be
 * Super User (flag or Super role), or status ACTIVE.
 */
export async function requireActive() {
  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return { allowed: false as const, reason: "unauthenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    return { allowed: false as const, reason: "no_profile" };
  }

  if (profile.is_super_user) {
    return { allowed: true as const, user: authUser, profile };
  }

  if (profile.status === "ACTIVE") {
    return { allowed: true as const, user: authUser, profile };
  }

  if (profile.status === "DISABLED") {
    return { allowed: false as const, reason: "disabled" };
  }

  const { data: superRole } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", authUser.id)
    .eq("role_id", SUPER_ROLE_ID)
    .maybeSingle();

  if (superRole) {
    return { allowed: true as const, user: authUser, profile };
  }

  return { allowed: false as const, reason: "unauthenticated" };
}

export type RequireSuperResult = { allowed: true; profile: UsersProfile } | { allowed: false };

/** Use in API routes / pages where only Super User is allowed (e.g. user management, assign roles). */
export async function requireSuper(): Promise<RequireSuperResult> {
  const { profile } = await getCurrentUserProfile();
  if (!profile) return { allowed: false };
  if (profile.is_super_user) return { allowed: true, profile };
  const { isSuper } = await getCurrentUserRolesAndPermissions();
  if (isSuper) return { allowed: true, profile };
  return { allowed: false };
}
