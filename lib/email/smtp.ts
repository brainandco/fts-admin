import nodemailer from "nodemailer";

export type SendEmailResult = { sent: boolean; error?: string };

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim(),
  );
}

function getTransporter() {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "465");
  const secure = process.env.SMTP_SECURE?.trim() !== "false" && port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
}

function fromAddress(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@fts-ksa.com"
  );
}

/**
 * Shared SMTP send for admin portal mail (credentials, invites, etc.).
 */
export async function sendSmtpMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  if (!smtpConfigured()) {
    return {
      sent: false,
      error:
        "SMTP not configured. Locally: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in fts-admin/.env.local and restart. On Vercel: Project → Environment Variables.",
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"FTS Admin" <${fromAddress()}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      // Helps avoid clients treating create + resend as one collapsed thread.
      headers: {
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
    console.info("[email] SMTP accepted", {
      to: opts.to,
      subject: opts.subject,
      messageId: info.messageId,
      response: info.response,
    });
    return { sent: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP send failed:", err);
    return { sent: false, error: raw };
  }
}
