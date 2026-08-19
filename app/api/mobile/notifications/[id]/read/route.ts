import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

/** PATCH — mark notification as read for signed-in admin mobile user. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveApiAuthContext(_req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const supabase = await getDataClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("id", id)
    .eq("recipient_user_id", ctx.userId);

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
