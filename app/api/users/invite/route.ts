import { randomUUID } from "crypto";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { sendAdminInvitationEmail } from "@/lib/email/send-admin-invitation-email";
import { getAdminPortalBaseUrl } from "@/lib/email/admin-portal-base-url";
import { randomPassword } from "@/lib/email/send-employee-credentials";

/**
 * POST /api/users/invite — Super user creates a new admin user and sends credentials by email.
 * Profile is PENDING_ACCESS until they accept; then status becomes ACTIVE. Super assigns roles after acceptance.
 */
export async function POST(req: Request) {
  const access = await requireSuper();
  if (!access.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  /** Initial auth password is random; the invited user receives credentials only after accepting (second email). */
  const password = randomPassword(18);

  if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 });

  const supabase = await getDataClient();
  const { data: existingEmployee } = await supabase
    .from("employees")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (existingEmployee) {
    return NextResponse.json({ message: "This email is registered as an employee. Employees use the Employee Portal only and cannot be added as users." }, { status: 400 });
  }

  const token = randomUUID();
  const sentAt = new Date();
  const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);

  const admin = createServerSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) {
      return NextResponse.json({ message: "A user with this email already exists." }, { status: 400 });
    }
    return NextResponse.json({ message: authError.message }, { status: 400 });
  }

  const user = authData.user;
  if (!user) return NextResponse.json({ message: "User creation failed" }, { status: 400 });

  const base = getAdminPortalBaseUrl();
  const acceptInvitationUrl = `${base}/invite/accept?token=${encodeURIComponent(token)}`;

  const { error: profileError } = await supabase.from("users_profile").upsert(
    {
      id: user.id,
      email: user.email ?? email,
      full_name: full_name || null,
      status: "PENDING_ACCESS",
      invitation_token: token,
      invitation_sent_at: sentAt.toISOString(),
      invitation_expires_at: expiresAt.toISOString(),
      invitation_accepted_at: null,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 400 });
  }

  const sendResult = await sendAdminInvitationEmail(email, full_name, acceptInvitationUrl);
  await auditLog({
    actionType: "create",
    entityType: "user",
    entityId: user.id,
    newValue: { email, full_name, status: "PENDING_ACCESS", invitation_expires_at: expiresAt.toISOString() },
    description: "User invited; invitation email sent (credentials after accept)",
  });

  return NextResponse.json({
    ok: true,
    id: user.id,
    message: sendResult.sent
      ? "Invitation sent. They must accept within 24 hours; login details will be emailed after they accept."
      : "User created. Sending invitation email failed: " + (sendResult.error ?? "unknown"),
    emailSent: sendResult.sent,
  });
}
