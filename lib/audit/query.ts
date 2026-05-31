import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAuditLogRow } from "@/lib/audit/log";

const EXTENDED_SELECT =
  "id, timestamp, actor_user_id, actor_email, action_type, entity_type, entity_id, description, meta, old_value_json, new_value_json, ip_address, user_agent, portal, route_path, http_method, status_code, action_category";

const CORE_SELECT =
  "id, timestamp, actor_user_id, actor_email, action_type, entity_type, entity_id, description, meta, old_value_json, new_value_json, ip_address, user_agent";

export type AuditQueryFilters = {
  portal?: string;
  actionCategory?: string;
  entityType?: string;
  actionType?: string;
  actor?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  entityId?: string;
};

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: AuditQueryFilters,
  opts: { extendedColumns: boolean }
) {
  const { portal, actionCategory, entityType, actionType, actor, q, dateFrom, dateTo, entityId } = filters;

  if (portal === "admin") {
    query = query.or("portal.eq.admin,portal.is.null");
  } else if (portal) {
    query = query.eq("portal", portal);
  }

  if (actionCategory) {
    if (opts.extendedColumns) {
      query = query.eq("action_category", actionCategory);
    } else {
      query = applyLegacyActionCategoryFilter(query, actionCategory);
    }
  }
  if (entityType) query = query.eq("entity_type", entityType);
  if (actionType) query = query.ilike("action_type", `%${actionType}%`);
  if (entityId) query = query.eq("entity_id", entityId);
  if (actor) query = query.ilike("actor_email", `%${actor}%`);
  if (dateFrom) query = query.gte("timestamp", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lte("timestamp", `${dateTo}T23:59:59.999Z`);

  if (q) {
    if (opts.extendedColumns) {
      query = query.or(`description.ilike.%${q}%,route_path.ilike.%${q}%,actor_email.ilike.%${q}%`);
    } else {
      query = query.or(`description.ilike.%${q}%,actor_email.ilike.%${q}%`);
    }
  }

  return query;
}

export async function fetchAuditLogs(
  supabase: SupabaseClient,
  filters: AuditQueryFilters,
  range: { from: number; to: number }
): Promise<{ logs: Record<string, unknown>[]; total: number; extendedColumns: boolean }> {
  let extendedColumns = true;

  let query = supabase
    .from("audit_logs")
    .select(EXTENDED_SELECT, { count: "exact" })
    .order("timestamp", { ascending: false });

  query = applyFilters(query, filters, { extendedColumns: true });

  const extendedResult = await query.range(range.from, range.to);
  let rows: Record<string, unknown>[] = (extendedResult.data ?? []) as Record<string, unknown>[];
  let total = extendedResult.count ?? 0;
  let fetchError = extendedResult.error;

  if (fetchError && isMissingColumnError(fetchError.message)) {
    extendedColumns = false;
    let coreQuery = supabase
      .from("audit_logs")
      .select(CORE_SELECT, { count: "exact" })
      .order("timestamp", { ascending: false });

    coreQuery = applyFilters(coreQuery, filters, { extendedColumns: false });
    const coreResult = await coreQuery.range(range.from, range.to);
    rows = (coreResult.data ?? []) as Record<string, unknown>[];
    total = coreResult.count ?? 0;
    fetchError = coreResult.error;
  }

  if (fetchError) throw new Error(fetchError.message);

  const logs = rows.map((row) => normalizeAuditLogRow(row));

  return { logs, total, extendedColumns };
}

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("column") || m.includes("schema cache") || m.includes("could not find");
}

/** Map category filter to action_type when action_category column is unavailable (legacy rows). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLegacyActionCategoryFilter(query: any, actionCategory: string) {
  switch (actionCategory) {
    case "data":
      return query.in("action_type", ["create", "update", "delete"]);
    case "import":
      return query.or("action_type.eq.import_save,action_type.eq.import_parse,description.ilike.%import%");
    case "export":
      return query.or("action_type.eq.export,description.ilike.%export%");
    case "file":
      return query.or(
        "action_type.ilike.%file%,action_type.ilike.%upload%,action_type.ilike.%download%,action_type.ilike.%presign%"
      );
    case "assignment":
      return query.or("action_type.ilike.%assign%,action_type.ilike.%return%,description.ilike.%assign%");
    case "approval":
      return query.or("action_type.ilike.%approv%,action_type.ilike.%leave%");
    case "auth":
      return query.or("action_type.ilike.%login%,action_type.ilike.%logout%,action_type.ilike.%register%");
    case "api":
      return query.eq("action_type", "api_access");
    default:
      return query;
  }
}
