/**
 * Send employee portal login credentials by email (Resend SDK).
 * Requires RESEND_API_KEY. Portal URLs come from getEmployeePortalBaseUrl() (see employee-portal-base-url.ts).
 * RESEND_FROM_EMAIL must use your verified Resend domain (e.g. noreply@admin.fts-ksa.com if admin.fts-ksa.com is verified).
 */

import { Resend } from "resend";
import { getEmployeePortalBaseUrl } from "@/lib/email/employee-portal-base-url";

export function randomPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export type SendCredentialsResult = { sent: boolean; error?: string };

export async function sendEmployeeCredentials(
  email: string,
  fullName: string,
  password: string
): Promise<SendCredentialsResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const portalUrl = getEmployeePortalBaseUrl();
  const loginUrl = `${portalUrl}/login`;

  if (!apiKey?.trim()) {
    return {
      sent: false,
      error:
        "RESEND_API_KEY not set for this server. Locally: add RESEND_API_KEY to fts-admin/.env.local and restart dev. On Vercel: Project → Settings → Environment Variables (not .env.local).",
    };
  }

  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>Your employee portal account has been created. Use the details below to sign in.</p>
    <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    <p><strong>Sign in:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Change your password after first sign-in from the portal settings if available.</p>
    <p>If you did not expect this email, contact your administrator.</p>
  `;

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Your Employee Portal Login",
    html,
  });

  if (error) {
    const raw = error.message || String(error);
    const hint =
      /verify a domain|testing emails|only send testing/i.test(raw)
        ? " Add your domain at https://resend.com/domains (DNS), then set RESEND_FROM_EMAIL to an address on that verified domain (subdomain and root are different, e.g. noreply@admin.fts-ksa.com)."
        : "";
    return { sent: false, error: raw + hint };
  }
  return { sent: true };
}
