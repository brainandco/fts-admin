/**
 * Verification link sent TO the new address; From uses SMTP_FROM / SMTP_USER.
 */

import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";
import { sendSmtpMail, type SendEmailResult } from "@/lib/email/smtp";

export type { SendEmailResult };

export async function sendAdminEmailChangeVerification(
  newEmail: string,
  fullName: string | null,
  verifyUrl: string,
): Promise<SendEmailResult> {
  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>You requested to use this email address for your Admin Portal account. Confirm the change by clicking the link below.</p>
    <p><a href="${verifyUrl}">Verify this email address</a></p>
    <p>If the link does not work, copy and paste this URL into your browser:</p>
    <p style="word-break:break-all;font-size:12px;color:#444;">${verifyUrl}</p>
    <p>This link expires in 24 hours. If you did not request this change, you can ignore this email.</p>
  `;

  return sendSmtpMail({
    to: newEmail,
    subject: "Confirm your new Admin Portal email",
    html,
  });
}

export function buildAdminEmailChangeVerifyUrl(token: string): string {
  const base = getAdminPortalBaseUrl();
  return `${base}/verify-email-change?token=${encodeURIComponent(token)}`;
}
