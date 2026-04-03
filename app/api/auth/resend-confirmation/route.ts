import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { requireSuper } from "@/lib/rbac/permissions";

/**
 * Super User can resend a confirmation link for a user (e.g. when the
 * original email expired). For users already in Auth we use a magic link so they
 * can confirm by opening the link. Returns the URL so the Super User can send
 * it to the user (copy or forward). Status and roles must stay Pending/locked
 * until the user confirms via this link.
 */
export async function POST(request: NextRequest) {
  const superAccess = await requireSuper();
  if (!superAccess.allowed) {
    return NextResponse.json({ message: "Only Super User can resend confirmation emails." }, { status: 403 });
  }

  let body: { user_id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  let email: string | null = null;
  let userId: string | null = null;

  if (body.user_id) {
    const { data: profile } = await supabase.from("users_profile").select("email").eq("id", body.user_id).single();
    if (!profile?.email) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    email = profile.email;
    userId = body.user_id;
  } else if (body.email?.trim()) {
    email = body.email.trim();
  }

  if (!email) {
    return NextResponse.json({ message: "user_id or email is required" }, { status: 400 });
  }

  try {
    const admin = createServerSupabaseAdmin();
    if (userId) {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      if (authUser?.user?.email_confirmed_at) {
        return NextResponse.json(
          { message: "This user has already confirmed their email. No need to resend." },
          { status: 400 }
        );
      }
    }
    // Use magiclink for existing users (signup type fails with "already registered")
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: request.nextUrl.origin + "/login",
      },
    });
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    const actionLink = (data?.properties as { action_link?: string } | undefined)?.action_link ?? null;
    if (!actionLink) {
      return NextResponse.json(
        { message: "Could not generate confirmation link. The auth server did not return a link." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, confirmation_url: actionLink });
  } catch (e) {
    return NextResponse.json(
      { message: process.env.NODE_ENV === "development" ? (e as Error).message : "Failed to generate link" },
      { status: 500 }
    );
  }
}
