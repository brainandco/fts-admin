import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { fetchAuditLogs } from "@/lib/audit/query";

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

  try {
    const supabase = await getDataClient();
    const { logs, total, extendedColumns } = await fetchAuditLogs(
      supabase,
      {
        portal: url.searchParams.get("portal")?.trim() || undefined,
        actionCategory: url.searchParams.get("action_category")?.trim() || undefined,
        entityType: url.searchParams.get("entity_type")?.trim() || undefined,
        actionType: url.searchParams.get("action_type")?.trim() || undefined,
        actor: url.searchParams.get("actor")?.trim() || undefined,
        q: url.searchParams.get("q")?.trim() || undefined,
        dateFrom: url.searchParams.get("from")?.trim() || undefined,
        dateTo: url.searchParams.get("to")?.trim() || undefined,
        entityId: url.searchParams.get("entity_id")?.trim() || undefined,
      },
      { from, to }
    );

    return NextResponse.json({
      logs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      extendedColumns,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load audit logs";
    return NextResponse.json({ message, logs: [], total: 0 }, { status: 400 });
  }
}
