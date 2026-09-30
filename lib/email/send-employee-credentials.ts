/**
 * Send employee portal login credentials by email (SMTP).
 * Portal URLs come from getEmployeePortalBaseUrl().
 */

import { getEmployeePortalBaseUrl } from "@/lib/email/employee-portal-base-url";
import { sendSmtpMail, type SendEmailResult } from "@/lib/email/smtp";

export function randomPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export type { SendEmailResult };

export async function sendEmployeeCredentials(
  email: string,
  fullName: string,
  password: string,
  opts?: { kind?: "create" | "resend" },
): Promise<SendEmailResult> {
  const portalUrl = getEmployeePortalBaseUrl();
  const loginUrl = `${portalUrl}/login`;
  const isResend = opts?.kind === "resend";

  // Distinct subject/body so clients don't collapse/spam-filter a duplicate of the create mail.
  const subject = isResend
    ? "Employee Portal — new temporary password"
    : "Your Employee Portal Login";
  const intro = isResend
    ? "Your administrator reset your Employee Portal password. Use the new temporary password below to sign in."
    : "Your employee portal account has been created. Use the details below to sign in.";

  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>${intro}</p>
    <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    <p><strong>Sign in:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Change your password after first sign-in from the portal settings if available.</p>
    <p>If you did not expect this email, contact your administrator.</p>
  `;

  return sendSmtpMail({
    to: email,
    subject,
    html,
  });
}
