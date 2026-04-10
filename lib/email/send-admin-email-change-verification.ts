/**
 * Verification link sent TO the new address; From uses RESEND_FROM_EMAIL (e.g. noreply@admin.fts-ksa.com).
 */

import { Resend } from "resend";
import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";

export type SendEmailResult = { sent: boolean; error?: string };

export async function sendAdminEmailChangeVerification(
  newEmail: string,
  fullName: string | null,
  verifyUrl: string
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
    <p>You requested to use this email address for your Admin Portal account. Confirm the change by clicking the link below.</p>
    <p><a href="${verifyUrl}">Verify this email address</a></p>
    <p>If the link does not work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;font-size:12px;color:#444;">${verifyUrl}</p>
    <p>This link expires in 24 hours. If you did not request this change, you can ignore this email.</p>
  `;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: newEmail,
    subject: "Confirm your new Admin Portal email",
    html,
  });

  if (error) {
    const raw = error.message || String(error);
    const hint =
      /verify a domain|testing emails|only send testing/i.test(raw)
        ? " Add your domain at https://resend.com/domains (DNS), then set RESEND_FROM_EMAIL to an address on that domain (e.g. noreply@admin.fts-ksa.com)."
        : "";
    return { sent: false, error: raw + hint };
  }
  return { sent: true };
}

export function buildAdminEmailChangeVerifyUrl(token: string): string {
  const base = getAdminPortalBaseUrl();
  return `${base}/verify-email-change?token=${encodeURIComponent(token)}`;
}
