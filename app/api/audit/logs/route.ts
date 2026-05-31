import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: Request) {
  if (!(await can("audit_logs.view_all"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const portal = url.searchParams.get("portal")?.trim();
  const actionCategory = url.searchParams.get("action_category")?.trim();
  const entityType = url.searchParams.get("entity_type")?.trim();
  const actionType = url.searchParams.get("action_type")?.trim();
  const actor = url.searchParams.get("actor")?.trim();
  const q = url.searchParams.get("q")?.trim();
  const dateFrom = url.searchParams.get("from")?.trim();
  const dateTo = url.searchParams.get("to")?.trim();
  const entityId = url.searchParams.get("entity_id")?.trim();

  const supabase = await getDataClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, timestamp, actor_user_id, actor_email, action_type, entity_type, entity_id, description, portal, route_path, http_method, status_code, action_category, meta, old_value_json, new_value_json",
      { count: "exact" }
    )
    .order("timestamp", { ascending: false });

  if (portal) query = query.eq("portal", portal);
  if (actionCategory) query = query.eq("action_category", actionCategory);
  if (entityType) query = query.eq("entity_type", entityType);
  if (actionType) query = query.ilike("action_type", `%${actionType}%`);
  if (entityId) query = query.eq("entity_id", entityId);
  if (actor) query = query.ilike("actor_email", `%${actor}%`);
  if (dateFrom) query = query.gte("timestamp", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte("timestamp", `${dateTo}T23:59:59.999Z`);
  if (q) {
    query = query.or(`description.ilike.%${q}%,route_path.ilike.%${q}%,actor_email.ilike.%${q}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  return NextResponse.json({
    logs: data ?? [],
    page,
    limit,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}
