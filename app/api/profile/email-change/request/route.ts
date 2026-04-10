import { NextResponse } from "next/server";
import { getEmployeeEmailSet, isPortalAdminByEmail } from "@/lib/delegations/participants";
import {
  EMAIL_CHANGE_EXPIRY_MS,
  findUserIdByEmail,
  generateEmailChangeToken,
  hashEmailChangeToken,
  isValidEmailFormat,
  normalizeEmail,
} from "@/lib/profile/admin-email-change";
import { requireActive } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import {
  buildAdminEmailChangeVerifyUrl,
  sendAdminEmailChangeVerification,
} from "@/lib/email/send-admin-email-change-verification";

/**
 * POST — Admin portal user requests email change; sends verification to the NEW address only.
 */
export async function POST(req: Request) {
  const access = await requireActive();
  if (!access.allowed || !access.user || !access.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { new_email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.new_email === "string" ? body.new_email : "";
  const newEmail = normalizeEmail(raw);
  const currentEmail = normalizeEmail(access.user.email ?? "");

  if (!newEmail || !isValidEmailFormat(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (newEmail === currentEmail) {
    return NextResponse.json({ error: "That is already your current email." }, { status: 400 });
  }

  const dataClient = await getDataClient();
  const employeeEmails = await getEmployeeEmailSet(dataClient);
  // Same rule as dashboard layout: session email must not be an employee-only account.
  if (!isPortalAdminByEmail(access.user.email, employeeEmails)) {
    return NextResponse.json({ error: "Email change is only available for admin accounts." }, { status: 403 });
  }

  const takenBy = await findUserIdByEmail(newEmail);
  if (takenBy && takenBy !== access.user.id) {
    return NextResponse.json({ error: "That email is already used by another account." }, { status: 400 });
  }

  const token = generateEmailChangeToken();
  const tokenHash = hashEmailChangeToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRY_MS).toISOString();

  const admin = createServerSupabaseAdmin();
  const { error: upsertErr } = await admin.from("admin_email_change_requests").upsert(
    {
      user_id: access.user.id,
      new_email: newEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    },
    { onConflict: "user_id" }
  );

  if (upsertErr) {
    const hint =
      /relation|does not exist|42P01/i.test(upsertErr.message)
        ? " Apply migration 00054_admin_email_change_requests.sql to your Supabase database."
        : "";
    return NextResponse.json({ error: upsertErr.message + hint }, { status: 400 });
  }

  const verifyUrl = buildAdminEmailChangeVerifyUrl(token);
  const sendResult = await sendAdminEmailChangeVerification(
    newEmail,
    access.profile.full_name,
    verifyUrl
  );

  if (!sendResult.sent) {
    await admin.from("admin_email_change_requests").delete().eq("user_id", access.user.id);
    console.error("[email-change] Resend failed:", sendResult.error);
    return NextResponse.json(
      {
        error:
          sendResult.error ??
          "Could not send verification email. Check RESEND_API_KEY and RESEND_FROM_EMAIL on the server (e.g. Vercel env).",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `We sent a verification link to ${newEmail}. Open that email and confirm to finish the change.`,
  });
}
