import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { sendUserCredentials } from "@/lib/email/send-user-credentials";
import { randomPassword } from "@/lib/email/send-employee-credentials";
import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";

const SUPER_ROLE_ID = "a0000000-0000-0000-0000-000000000000";

/**
 * POST /api/users/[id]/resend-invitation — New 24h invitation link + optional new password (email).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) {
    return NextResponse.json({ message: "Only Super User can resend invitations." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await getDataClient();
  const admin = createServerSupabaseAdmin();

  const { data: profile, error: pErr } = await supabase
    .from("users_profile")
    .select("id, email, full_name, is_super_user")
    .eq("id", id)
    .single();

  if (pErr || !profile) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  if (profile.is_super_user) {
    return NextResponse.json({ message: "Cannot resend invitation for the seeded Super User account." }, { status: 400 });
  }

  const { data: superRole } = await supabase.from("user_roles").select("role_id").eq("user_id", id).eq("role_id", SUPER_ROLE_ID).maybeSingle();
  if (superRole) {
    return NextResponse.json({ message: "Cannot resend invitation for a Super User role holder." }, { status: 400 });
  }

  const email = (profile.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ message: "User has no email" }, { status: 400 });
  }

  const password = randomPassword(14);
  const { error: authErr } = await admin.auth.admin.updateUserById(id, { password });
  if (authErr) {
    return NextResponse.json({ message: authErr.message }, { status: 400 });
  }

  const token = randomUUID();
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);

  const { error: updErr } = await supabase
    .from("users_profile")
    .update({
      invitation_token: token,
      invitation_sent_at: sentAt.toISOString(),
      invitation_expires_at: expiresAt.toISOString(),
      invitation_accepted_at: null,
      status: "PENDING_ACCESS",
    })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ message: updErr.message }, { status: 400 });
  }

  const base = getAdminPortalBaseUrl();
  const acceptInvitationUrl = `${base}/invite/accept?token=${encodeURIComponent(token)}`;

  const sendResult = await sendUserCredentials(email, profile.full_name ?? "", password, { acceptInvitationUrl });

  await auditLog({
    actionType: "update",
    entityType: "user",
    entityId: id,
    description: "Invitation resent (new 24h window, new password emailed)",
  });

  return NextResponse.json({
    ok: true,
    emailSent: sendResult.sent,
    error: sendResult.error,
  });
}
