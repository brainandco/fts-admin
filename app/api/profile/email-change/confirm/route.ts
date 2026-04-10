import { NextResponse } from "next/server";
import {
  findUserIdByEmail,
  hashEmailChangeToken,
  normalizeEmail,
} from "@/lib/profile/admin-email-change";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST — Confirm email change using the token from the email (no login required).
 */
export async function POST(req: Request) {
  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const admin = createServerSupabaseAdmin();
  const tokenHash = hashEmailChangeToken(token);
  const { data: row, error: fetchErr } = await admin
    .from("admin_email_change_requests")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Invalid or expired link. Request a new email change from your profile." },
      { status: 400 }
    );
  }

  const userId = row.user_id as string;
  const newEmail = normalizeEmail(row.new_email as string);

  const takenBy = await findUserIdByEmail(newEmail);
  if (takenBy && takenBy !== userId) {
    await admin.from("admin_email_change_requests").delete().eq("user_id", userId);
    return NextResponse.json(
      { error: "That email was taken by another account. Start again with a different address." },
      { status: 409 }
    );
  }

  const { data: profileBefore } = await admin.from("users_profile").select("email").eq("id", userId).maybeSingle();
  const oldEmail = profileBefore?.email ?? null;

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const { error: profileErr } = await admin.from("users_profile").update({ email: newEmail }).eq("id", userId);

  if (profileErr) {
    console.error("users_profile email update failed after auth update", profileErr);
    return NextResponse.json(
      { error: "Email was updated in auth but profile sync failed. Contact support." },
      { status: 500 }
    );
  }

  await admin.from("admin_email_change_requests").delete().eq("user_id", userId);

  await admin.from("audit_logs").insert({
    actor_user_id: userId,
    actor_email: newEmail,
    action_type: "update",
    entity_type: "user",
    entity_id: userId,
    old_value_json: { email: oldEmail },
    new_value_json: { email: newEmail },
    description: "Admin email changed via verification link",
    meta: { source: "email_change_confirm" },
  });

  return NextResponse.json({
    ok: true,
    message: "Your email has been updated. Sign in with your new address.",
    email: newEmail,
  });
}
