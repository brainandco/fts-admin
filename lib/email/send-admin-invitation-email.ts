/**
 * First email: invitation link only (no password). User accepts on /invite/accept?token=…
 */

import { sendSmtpMail, type SendEmailResult } from "@/lib/email/smtp";

export type { SendEmailResult };

export async function sendAdminInvitationEmail(
  email: string,
  fullName: string,
  acceptInvitationUrl: string,
): Promise<SendEmailResult> {
  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>You have been invited to the <strong>Admin Portal</strong>.</p>
    <p><strong>Accept your invitation</strong> (link expires in 24 hours):</p>
    <p style="margin:16px 0;">
      <a href="${acceptInvitationUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept invitation</a>
    </p>
    <p style="font-size:13px;color:#52525b;">You do not need to sign in first. After you accept, we will email you the portal link and your login password.</p>
    <p>If you did not expect this email, contact your administrator.</p>
  `;

  return sendSmtpMail({
    to: email,
    subject: "You're invited to the Admin Portal",
    html,
  });
}
