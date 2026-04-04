import { NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit/log";
import { randomPassword } from "@/lib/email/send-employee-credentials";
import { sendAdminPortalCredentialsEmail } from "@/lib/email/send-admin-credentials-email";

/**
 * POST /api/invite/accept — Accept invitation with token only (no sign-in required).
 * Sets profile Active, assigns a new password, emails portal link + credentials.
 */
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ message: "Invitation token is required" }, { status: 400 });
  }

  const admin = createServerSupabaseAdmin();
  const { data: profile, error: selErr } = await admin
    .from("users_profile")
    .select("id, email, full_name, invitation_token, invitation_expires_at, invitation_accepted_at")
    .eq("invitation_token", token)
    .maybeSingle();

  if (selErr || !profile) {
    return NextResponse.json({ message: "Invalid or expired invitation link." }, { status: 400 });
  }

  if (profile.invitation_accepted_at) {
    return NextResponse.json({ ok: true, message: "Already accepted" });
  }

  const exp = profile.invitation_expires_at ? new Date(profile.invitation_expires_at).getTime() : NaN;
  if (!Number.isNaN(exp) && Date.now() > exp) {
    return NextResponse.json(
      { message: "This invitation has expired. Ask a Super User to resend the invitation." },
      { status: 400 }
    );
  }

  const newPassword = randomPassword(16);
  const { error: pwErr } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (pwErr) {
    return NextResponse.json({ message: pwErr.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("users_profile")
    .update({
      invitation_accepted_at: now,
      invitation_token: null,
      status: "ACTIVE",
    })
    .eq("id", profile.id);

  if (updErr) {
    return NextResponse.json({ message: updErr.message }, { status: 400 });
  }

  const emailAddr = (profile.email ?? "").trim();
  const sendResult = await sendAdminPortalCredentialsEmail(emailAddr, profile.full_name ?? "", newPassword);

  await auditLog({
    actionType: "update",
    entityType: "user",
    entityId: profile.id,
    newValue: { status: "ACTIVE", invitation_accepted_at: now },
    description: "Admin invitation accepted (token); credentials emailed",
  });

  if (!sendResult.sent) {
    return NextResponse.json({
      ok: true,
      warning: sendResult.error ?? "Invitation accepted, but the credentials email could not be sent.",
    });
  }

  return NextResponse.json({ ok: true });
}
