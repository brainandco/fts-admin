import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getInvitationGate } from "@/lib/invitation";

/** GET /api/invite/status — Current user invitation state (for accept page). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const { data: profile } = await supabase
    .from("users_profile")
    .select("invitation_token, invitation_expires_at, invitation_accepted_at, is_super_user")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ authenticated: true, hasProfile: false });
  }

  const gate = getInvitationGate(profile);
  return NextResponse.json({
    authenticated: true,
    hasProfile: true,
    gateOk: gate.ok,
    reason: gate.ok ? null : gate.reason,
    invitation_expires_at: profile.invitation_expires_at,
  });
}
