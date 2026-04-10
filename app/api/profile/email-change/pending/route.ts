import { NextResponse } from "next/server";
import { requireActive } from "@/lib/rbac/permissions";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

/** GET — Whether the current user has a pending email change (verification not completed). */
export async function GET() {
  const access = await requireActive();
  if (!access.allowed || !access.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServerSupabaseAdmin();
  const { data: row, error } = await admin
    .from("admin_email_change_requests")
    .select("new_email, expires_at")
    .eq("user_id", access.user.id)
    .maybeSingle();

  if (error) {
    console.error("[email-change/pending]", error.message);
    const hint =
      /relation|does not exist|42P01/i.test(error.message)
        ? " Apply migration 00054_admin_email_change_requests.sql in Supabase SQL Editor."
        : "";
    return NextResponse.json({
      pending: false,
      configError: error.message + hint,
    });
  }

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row) await admin.from("admin_email_change_requests").delete().eq("user_id", access.user.id);
    return NextResponse.json({ pending: false });
  }

  return NextResponse.json({
    pending: true,
    new_email: row.new_email,
    expires_at: row.expires_at,
  });
}
