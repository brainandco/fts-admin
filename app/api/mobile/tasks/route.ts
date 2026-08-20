import { NextResponse } from "next/server";
import { resolveApiAuthContext } from "@/lib/mobile/api-auth-context";
import { getDataClient } from "@/lib/supabase/server";
import type { UsersProfileWithRegion } from "@/lib/types/database";

/** GET — overdue/open tasks list for Admin Lite mobile. */
export async function GET(req: Request) {
  const ctx = await resolveApiAuthContext(req);
  if (!ctx) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const canViewTasks = ctx.isSuper || ctx.permissions.has("tasks.view_all") || ctx.permissions.has("tasks.edit");
  if (!canViewTasks) {
    return NextResponse.json({ message: "You do not have access to tasks." }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "all" ? "all" : "overdue";
  const regionId = (ctx.profile as UsersProfileWithRegion).region_id ?? null;

  const supabase = await getDataClient();
  let query = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, region_id, created_at")
    .order("created_at", { ascending: false })
    .limit(120);

  if (regionId && !ctx.isSuper) query = query.eq("region_id", regionId);
  if (mode === "overdue") {
    query = query
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .in("status", ["Draft", "Assigned_to_PM", "Assigned_to_User", "In_Progress", "Blocked"]);
  }

  const { data: tasks, error } = await query;
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const regionIds = [...new Set((tasks ?? []).map((t) => t.region_id).filter(Boolean))];
  const { data: regions } = regionIds.length
    ? await supabase.from("regions").select("id, name").in("id", regionIds)
    : { data: [] as { id: string; name: string }[] };
  const regionMap = new Map((regions ?? []).map((r) => [r.id, r.name]));

  const items = (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority ?? null,
    dueDate: t.due_date ?? null,
    createdAt: t.created_at,
    regionName: t.region_id ? (regionMap.get(t.region_id) ?? t.region_id) : null,
    isOverdue:
      !!t.due_date &&
      t.due_date < new Date().toISOString().slice(0, 10) &&
      ["Draft", "Assigned_to_PM", "Assigned_to_User", "In_Progress", "Blocked"].includes(String(t.status ?? "")),
  }));

  return NextResponse.json({
    mode,
    count: items.length,
    items,
  });
}
