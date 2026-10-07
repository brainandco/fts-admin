import nodemailer from "nodemailer";

export type SendEmailResult = { sent: boolean; error?: string };

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim(),
  );
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
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
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@fts-ksa.com"
  );
}

/**
 * Prefer Resend when RESEND_API_KEY is set (production / Vercel).
 * Otherwise SMTP (local HostersPK fallback).
 */
export async function sendSmtpMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  if (resendConfigured()) {
    return sendViaResend(opts);
  }
  if (smtpConfigured()) {
    return sendViaSmtp(opts);
  }
  return {
    sent: false,
    error:
      "Email not configured. Set RESEND_API_KEY + RESEND_FROM_EMAIL (recommended on Vercel), or SMTP_HOST / SMTP_USER / SMTP_PASSWORD for local SMTP.",
  };
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = `"FTS Admin" <${fromAddress()}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        headers: {
          "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      const err = body.message || body.name || `Resend HTTP ${res.status}`;
      console.error("[email] Resend send failed:", body);
      return { sent: false, error: String(err) };
    }
    console.info("[email] Resend accepted", {
      to: opts.to,
      subject: opts.subject,
      id: body.id,
    });
    return { sent: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[email] Resend send failed:", err);
    return { sent: false, error: raw };
  }
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"FTS Admin" <${fromAddress()}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      headers: {
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
    });
    console.info("[email] SMTP accepted", {
      to: opts.to,
      subject: opts.subject,
      messageId: info.messageId,
      response: info.response,
      host: process.env.SMTP_HOST,
    });
    return { sent: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[email] SMTP send failed:", err);
    return { sent: false, error: raw };
  }
}
