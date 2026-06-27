import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsersProfile } from "@/lib/types/database";
import { getInvitationGate } from "@/lib/invitation";
import { getRolesAndPermissionsForUserId } from "@/lib/rbac/permissions";
import { getRequestAuth } from "@/lib/supabase/request-auth";
import { getDataClient } from "@/lib/supabase/server";

export type ApiAuthContext = {
  profile: UsersProfile;
  permissions: Set<string>;
  isSuper: boolean;
  canApprove: boolean;
  canReject: boolean;
  canViewApprovals: boolean;
  userClient: SupabaseClient;
  userId: string;
};

export async function resolveApiAuthContext(req: Request): Promise<ApiAuthContext | null> {
  const auth = await getRequestAuth(req);
  if (!auth) return null;

  const dataClient = await getDataClient();
  const { data: profile } = await dataClient
    .from("users_profile")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return null;

  const invitation = getInvitationGate(profile);
  if (!invitation.ok) return null;

  const active =
    profile.is_super_user === true ||
    profile.status === "ACTIVE" ||
    (await dataClient
      .from("user_roles")
      .select("role_id")
      .eq("user_id", auth.user.id)
      .eq("role_id", "a0000000-0000-0000-0000-000000000000")
      .maybeSingle()).data != null;

  if (!active) return null;

  const { permissions, isSuper } = await getRolesAndPermissionsForUserId(dataClient, auth.user.id, profile);
  const superAccess = isSuper || profile.is_super_user === true;
  const canApprove = superAccess || permissions.has("approvals.approve");
  const canReject = superAccess || permissions.has("approvals.reject");
  const canViewApprovals = superAccess || permissions.has("approvals.view") || canApprove || canReject;

  return {
    profile: profile as UsersProfile,
    permissions,
    isSuper: superAccess,
    canApprove,
    canReject,
    canViewApprovals,
    userClient: auth.supabase,
    userId: auth.user.id,
  };
}
