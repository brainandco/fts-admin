/**
 * Second email: after invitation is accepted — portal URL + email + password.
 */

import { Resend } from "resend";
import { getAdminPortalLoginPageUrl } from "@/lib/email/admin-portal-login-url";

export type SendEmailResult = { sent: boolean; error?: string };

export async function sendAdminPortalCredentialsEmail(
  email: string,
  fullName: string,
  password: string
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const portalUrl = getAdminPortalLoginPageUrl();
  const loginUrl = `${portalUrl}/login`;

  if (!apiKey?.trim()) {
    return {
      sent: false,
      error:
        "RESEND_API_KEY not set. Locally: fts-admin/.env.local + restart dev. On Vercel: Project → Environment Variables.",
    };
  }

  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>Your invitation has been accepted. Use the details below to sign in to the Admin Portal.</p>
    <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    <p><strong>Sign in:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Change your password after first sign-in from the portal settings if available.</p>
    <p>If you did not expect this email, contact your administrator.</p>
  `;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your Admin Portal login details",
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
