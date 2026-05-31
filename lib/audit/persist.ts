import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditPersistRow = {
  actor_user_id: string | null;
  actor_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  old_value_json?: Record<string, unknown> | null;
  new_value_json?: Record<string, unknown> | null;
  description: string | null;
  meta?: Record<string, unknown> | null;
  portal?: string | null;
  route_path?: string | null;
  http_method?: string | null;
  status_code?: number | null;
  action_category?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("column") || m.includes("schema cache") || m.includes("could not find");
}

/** Insert audit row; falls back to legacy columns if migration 00074 not applied. */
export async function persistAuditRow(db: SupabaseClient, row: AuditPersistRow): Promise<boolean> {
  const fullRow = {
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email,
    action_type: row.action_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value_json: row.old_value_json ?? null,
    new_value_json: row.new_value_json ?? null,
    description: row.description,
    meta: row.meta ?? null,
    portal: row.portal ?? "admin",
    route_path: row.route_path ?? null,
    http_method: row.http_method ?? null,
    status_code: row.status_code ?? null,
    action_category: row.action_category ?? null,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  };

  const { error } = await db.from("audit_logs").insert(fullRow);
  if (!error) return true;

  const meta: Record<string, unknown> = {
    ...(row.meta ?? {}),
    _audit_v2: {
      portal: row.portal,
      action_category: row.action_category,
      route_path: row.route_path,
      http_method: row.http_method,
      status_code: row.status_code,
    },
  };

  const legacyRow = {
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email,
    action_type: row.action_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value_json: row.old_value_json ?? null,
    new_value_json: row.new_value_json ?? null,
    description: row.description,
    meta,
    ip_address: row.ip_address ?? null,
    user_agent: row.user_agent ?? null,
  };

  const { error: legacyError } = await db.from("audit_logs").insert(legacyRow);
  if (legacyError) {
    console.error("[audit] persist failed:", error.message, "| legacy:", legacyError.message);
    return false;
  }

  if (isMissingColumnError(error.message)) {
    console.warn("[audit] stored via legacy columns; apply migration 00074_audit_logs_enhanced.sql");
  }
  return true;
}

/** Routes that already call auditLog() with rich descriptions — skip duplicate middleware entries. */
export function isExplicitAuditedMutation(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;

  const auditedPrefixes = [
    /^\/api\/employees(\/|$)/,
    /^\/api\/assets(\/|$)/,
    /^\/api\/vehicles(\/|$)/,
    /^\/api\/sims(\/|$)/,
    /^\/api\/users(\/|$)/,
    /^\/api\/regions(\/|$)/,
    /^\/api\/projects(\/|$)/,
    /^\/api\/teams(\/|$)/,
    /^\/api\/tasks(\/|$)/,
    /^\/api\/approvals(\/|$)/,
    /^\/api\/leave-request/,
    /^\/api\/exports/,
    /\/import\/save$/,
    /\/bulk-delete$/,
  ];

  return auditedPrefixes.some((re) => re.test(pathname));
}
