import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** GET — notifications list + unread count for Admin Lite mobile (Bearer token). */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const raw = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(raw) ? Math.min(MAX_LIMIT, Math.max(1, raw)) : DEFAULT_LIMIT;
  const category = url.searchParams.get("category")?.trim() || null;

  const supabase = await getDataClient();
  let listQuery = supabase
    .from("notifications")
    .select("id, title, body, category, is_read, created_at, link")
    .eq("recipient_user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (category) listQuery = listQuery.eq("category", category);

  let unreadQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", ctx.userId)
    .eq("is_read", false);
  if (category) unreadQuery = unreadQuery.eq("category", category);

  const [listRes, unreadRes, categoriesRes] = await Promise.all([
    listQuery,
    unreadQuery,
    supabase
      .from("notifications")
      .select("category")
      .eq("recipient_user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (listRes.error) return NextResponse.json({ message: listRes.error.message }, { status: 400 });

  const categories = [...new Set((categoriesRes.data ?? []).map((r) => r.category).filter(Boolean))] as string[];

  return NextResponse.json({
    items: listRes.data ?? [],
    unreadCount: unreadRes.count ?? 0,
    categories,
  });
}
