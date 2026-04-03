import type { UsersProfile } from "@/lib/types/database";

export type InvitationGateReason = "invitation_pending" | "invitation_expired";

/** Fields used for invitation gate (full profile or a partial select). */
export type ProfileWithInvitation = Pick<
  UsersProfile,
  "is_super_user" | "invitation_token" | "invitation_expires_at" | "invitation_accepted_at"
>;

/**
 * Super users always pass. Legacy profiles (no invitation_token) pass.
 * Invited users must have invitation_accepted_at set before expiry.
 */
export function getInvitationGate(profile: ProfileWithInvitation): { ok: true } | { ok: false; reason: InvitationGateReason } {
  if (profile.is_super_user) return { ok: true };
  if (!profile.invitation_token) return { ok: true };
  if (profile.invitation_accepted_at) return { ok: true };
  const exp = profile.invitation_expires_at ? new Date(profile.invitation_expires_at).getTime() : NaN;
  if (!Number.isNaN(exp) && Date.now() > exp) return { ok: false, reason: "invitation_expired" };
  return { ok: false, reason: "invitation_pending" };
}
