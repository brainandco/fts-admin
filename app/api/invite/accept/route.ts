import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/invite/accept — Mark invitation as accepted (authenticated user must match token).
 */
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Not signed in" }, { status: 401 });

  const admin = createServerSupabaseAdmin();
  const { data: profile, error: selErr } = await admin
    .from("users_profile")
    .select("id, invitation_token, invitation_expires_at, invitation_accepted_at")
    .eq("id", user.id)
    .single();

  if (selErr || !profile) {
    return NextResponse.json({ message: "Profile not found" }, { status: 404 });
  }

  if (profile.invitation_accepted_at) {
    return NextResponse.json({ ok: true, message: "Already accepted" });
  }

  if (!profile.invitation_token) {
    return NextResponse.json({ message: "No pending invitation for this account" }, { status: 400 });
  }

  if (token && profile.invitation_token !== token) {
    return NextResponse.json({ message: "Invalid invitation token" }, { status: 400 });
  }

  const exp = profile.invitation_expires_at ? new Date(profile.invitation_expires_at).getTime() : NaN;
  if (!Number.isNaN(exp) && Date.now() > exp) {
    return NextResponse.json({ message: "This invitation has expired. Ask a Super User to resend the invitation." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("users_profile")
    .update({
      invitation_accepted_at: now,
      invitation_token: null,
    })
    .eq("id", user.id);

  if (updErr) {
    return NextResponse.json({ message: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
