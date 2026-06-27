import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import type { AuditActionCategory, AuditLogInput, AuditPortal } from "@/lib/audit/types";
import { persistAuditRow, type AuditPersistRow } from "@/lib/audit/persist";
import { getRequestAuth } from "@/lib/supabase/request-auth";

export type { AuditLogInput, AuditPortal, AuditActionCategory };

function clientIp(req?: Request | null): string | null {
  if (!req) return null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

function clientUserAgent(req?: Request | null): string | null {
  return req?.headers.get("user-agent") ?? null;
}

export async function resolveActor(req?: Request | null): Promise<{ userId: string | null; email: string | null }> {
  if (req) {
    const explicitId = req.headers.get("x-audit-actor-id");
    const explicitEmail = req.headers.get("x-audit-actor-email");
    if (explicitId || explicitEmail) {
      return { userId: explicitId, email: explicitEmail };
    }

    const auth = await getRequestAuth(req);
    if (auth) {
      const db = await getDataClient();
      const { data: profile } = await db.from("users_profile").select("email").eq("id", auth.user.id).maybeSingle();
      return { userId: auth.user.id, email: profile?.email ?? auth.user.email ?? null };
    }
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, email: null };

  const { data: profile } = await supabase.from("users_profile").select("email").eq("id", user.id).single();
  return { userId: user.id, email: profile?.email ?? user.email ?? null };
}

export function inferCategory(actionType: string): AuditActionCategory {
  const a = actionType.toLowerCase();
  if (a.includes("login") || a.includes("logout") || a.includes("register") || a.includes("auth")) return "auth";
  if (a.includes("upload") || a.includes("download") || a.includes("presign") || a.includes("file") || a.includes("multipart")) return "file";
  if (a.includes("import")) return "import";
  if (a.includes("export")) return "export";
  if (a.includes("assign") || a.includes("return") || a.includes("receipt")) return "assignment";
  if (a.includes("approv") || a.includes("leave")) return "approval";
  if (a === "api_access" || a.includes("api_")) return "api";
  if (a.includes("create") || a.includes("update") || a.includes("delete") || a.includes("view")) return "data";
  return "system";
}

/** Persist an audit event (service role when available; falls back if new columns missing). */
export async function auditLog(params: AuditLogInput & { req?: Request | null }) {
  const { req, ...rest } = params;
  const actor =
    rest.actorUserId !== undefined || rest.actorEmail !== undefined
      ? { userId: rest.actorUserId ?? null, email: rest.actorEmail ?? null }
      : await resolveActor(req);

  const row: AuditPersistRow = {
    actor_user_id: actor.userId,
    actor_email: actor.email,
    action_type: rest.actionType,
    entity_type: rest.entityType,
    entity_id: rest.entityId ?? null,
    old_value_json: rest.oldValue ?? null,
    new_value_json: rest.newValue ?? null,
    description: rest.description ?? null,
    meta: rest.meta ?? null,
    portal: rest.portal ?? "admin",
    route_path: rest.routePath ?? null,
    http_method: rest.httpMethod ?? null,
    status_code: rest.statusCode ?? null,
    action_category: rest.actionCategory ?? inferCategory(rest.actionType),
    ip_address: rest.ipAddress ?? clientIp(req) ?? null,
    user_agent: rest.userAgent ?? clientUserAgent(req) ?? null,
  };

  try {
    const db = await getDataClient();
    const ok = await persistAuditRow(db, row);
    if (!ok) {
      const userDb = await createServerSupabaseClient();
      await persistAuditRow(userDb, row);
    }
  } catch (e) {
    console.error("[audit] insert exception:", e);
    try {
      const userDb = await createServerSupabaseClient();
      await persistAuditRow(userDb, row);
    } catch (e2) {
      console.error("[audit] user client insert exception:", e2);
    }
  }
}

export async function auditLogFromRequest(
  req: Request,
  params: Omit<AuditLogInput, "routePath" | "httpMethod" | "ipAddress" | "userAgent">
) {
  const url = new URL(req.url);
  await auditLog({
    ...params,
    req,
    portal: params.portal ?? "admin",
    routePath: url.pathname,
    httpMethod: req.method,
  });
}

/** Normalize DB rows for API/UI (legacy rows without portal columns). */
export function normalizeAuditLogRow(row: Record<string, unknown>): Record<string, unknown> {
  const meta = (row.meta as Record<string, unknown> | null) ?? null;
  const v2 = (meta?._audit_v2 as Record<string, unknown> | undefined) ?? undefined;
  const actionType = String(row.action_type ?? "");

  return {
    ...row,
    portal: row.portal ?? v2?.portal ?? "admin",
    action_category: row.action_category ?? v2?.action_category ?? inferCategory(actionType),
    route_path: row.route_path ?? v2?.route_path ?? null,
    http_method: row.http_method ?? v2?.http_method ?? null,
    status_code: row.status_code ?? v2?.status_code ?? null,
  };
}
