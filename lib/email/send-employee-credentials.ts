/**
 * Send employee portal login credentials by email (Resend SDK).
 * Requires RESEND_API_KEY and EMPLOYEE_PORTAL_URL in env.
 */

import { Resend } from "resend";

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
  const portalUrl = process.env.EMPLOYEE_PORTAL_URL || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey?.trim()) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }
  if (!portalUrl?.trim()) {
    return { sent: false, error: "EMPLOYEE_PORTAL_URL not configured" };
  }

  const html = `
    <p>Hello${fullName ? ` ${fullName}` : ""},</p>
    <p>Your employee portal account has been created. Use the credentials below to sign in.</p>
    <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Password:</strong> ${password}</p>
    <p>Please change your password after your first login if the portal supports it.</p>
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
    return { sent: false, error: error.message || String(error) };
  }
  return { sent: true };
}
