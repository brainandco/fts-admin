/**
 * Send admin portal login credentials by email (Resend SDK).
 * Requires RESEND_API_KEY. From address must use a verified domain (e.g. fts-ksa.com).
 */

import { Resend } from "resend";

export type SendUserCredentialsResult = { sent: boolean; error?: string };

export async function sendUserCredentials(
  email: string,
  fullName: string,
  password: string
): Promise<SendUserCredentialsResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const adminPortalUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_PORTAL_URL || "";
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
    <p>Your admin portal account has been created. Use the credentials below to sign in.</p>
    <p><strong>Portal:</strong> <a href="${adminPortalUrl}">${adminPortalUrl}</a></p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Password:</strong> ${password}</p>
    <p>You can sign in immediately. Change your password after first login if the portal supports it.</p>
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
