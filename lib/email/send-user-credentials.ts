/**
 * Send admin portal login credentials by email (Resend SDK).
 * Requires RESEND_API_KEY. RESEND_FROM_EMAIL must sit on whatever domain you verified in Resend
 * (e.g. noreply@admin.fts-ksa.com if you verified admin.fts-ksa.com — not @fts-ksa.com unless that root domain is verified).
 */

import { Resend } from "resend";
import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";

export type SendUserCredentialsResult = { sent: boolean; error?: string };

export async function sendUserCredentials(
  email: string,
  fullName: string,
  password: string,
  options?: { acceptInvitationUrl?: string }
): Promise<SendUserCredentialsResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const adminPortalUrl = getAdminPortalBaseUrl();
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey?.trim()) {
    return {
      sent: false,
      error:
        "RESEND_API_KEY not set. Locally: fts-admin/.env.local + restart dev. On Vercel: Project → Environment Variables.",
    };
  }

  const acceptUrl = options?.acceptInvitationUrl?.trim() ?? "";
  const portalLine = `<p><strong>Portal:</strong> <a href="${adminPortalUrl}">${adminPortalUrl}</a></p>`;

  const acceptSection = acceptUrl
    ? `<p><strong>Accept invitation (required — link expires in 24 hours):</strong><br/>
      <a href="${acceptUrl}" style="display:inline-block;margin:10px 0;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept invitation</a><br/>
      <span style="font-size:12px;color:#52525b;">Or open this link: <a href="${acceptUrl}">${acceptUrl}</a></span></p>
      <p>Sign in at the portal above with the email and password below, then click <strong>Accept invitation</strong> (or open the link while signed in).</p>`
    : `<p>Sign in at the portal URL above with the credentials below.</p>`;

  const footerNote = acceptUrl
    ? `<p>You can use the dashboard only after you accept the invitation. You can change your password after first sign-in from the portal settings if available.</p>`
    : `<p>You can change your password after first sign-in from the portal settings if available.</p>`;

  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>Your admin portal account has been created.</p>
    ${portalLine}
    ${acceptSection}
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Password:</strong> ${password}</p>
    ${footerNote}
    <p>If you did not expect this email, contact your administrator.</p>
  `;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your Admin Portal Login",
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
