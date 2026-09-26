/**
 * Second email: after invitation is accepted — portal URL + email + password.
 */

import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";
import { sendSmtpMail, type SendEmailResult } from "@/lib/email/smtp";

export type { SendEmailResult };

export async function sendAdminPortalCredentialsEmail(
  email: string,
  fullName: string,
  password: string,
): Promise<SendEmailResult> {
  const portalUrl = getAdminPortalBaseUrl();
  const loginUrl = `${portalUrl}/login`;

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

  return sendSmtpMail({
    to: email,
    subject: "Your Admin Portal login details",
    html,
  });
}
