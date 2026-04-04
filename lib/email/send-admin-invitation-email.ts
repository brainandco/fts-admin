/**
 * First email: invitation link only (no password). User accepts on /invite/accept?token=…
 */

import { Resend } from "resend";

export type SendEmailResult = { sent: boolean; error?: string };

export async function sendAdminInvitationEmail(
  email: string,
  fullName: string,
  acceptInvitationUrl: string
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey?.trim()) {
    return {
      sent: false,
      error:
        "RESEND_API_KEY not set. Locally: fts-admin/.env.local + restart dev. On Vercel: Project → Environment Variables.",
    };
  }

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

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "You're invited to the Admin Portal",
    html,
  });

  if (error) {
    const raw = error.message || String(error);
    const hint =
      /verify a domain|testing emails|only send testing/i.test(raw)
        ? " Add your domain at https://resend.com/domains (DNS), then set RESEND_FROM_EMAIL to an address on that domain."
        : "";
    return { sent: false, error: raw + hint };
  }
  return { sent: true };
}
