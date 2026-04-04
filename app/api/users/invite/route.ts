import { randomUUID } from "crypto";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { sendUserCredentials } from "@/lib/email/send-user-credentials";

function adminPortalBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_PORTAL_URL || "").replace(/\/$/, "");
}

/**
 * POST /api/users/invite — Super user creates a new admin user and sends credentials by email.
 * Profile is PENDING_ACCESS until they accept; then status becomes ACTIVE. Super assigns roles after acceptance.
 */
export async function POST(req: Request) {
  const access = await requireSuper();
  if (!access.allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";

  if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ message: "Password must be at least 6 characters" }, { status: 400 });

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

  const base = adminPortalBaseUrl();
  const acceptInvitationUrl = base ? `${base}/invite/accept?token=${encodeURIComponent(token)}` : undefined;

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

  const sendResult = await sendUserCredentials(email, full_name, password, { acceptInvitationUrl });
  await auditLog({
    actionType: "create",
    entityType: "user",
    entityId: user.id,
    newValue: { email, full_name, status: "PENDING_ACCESS", invitation_expires_at: expiresAt.toISOString() },
    description: "User invited; credentials and invitation link sent by email",
  });

  return NextResponse.json({
    ok: true,
    id: user.id,
    message: sendResult.sent
      ? "User created. They must accept the invitation within 24 hours using the link in the email."
      : "User created. Sending email failed: " + (sendResult.error ?? "unknown"),
    emailSent: sendResult.sent,
  });
}
