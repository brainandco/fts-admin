import { createServerSupabaseClient, getDataClient } from "@/lib/supabase/server";
import type { AuditActionCategory, AuditLogInput, AuditPortal } from "@/lib/audit/types";

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
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, email: null };

  const { data: profile } = await supabase.from("users_profile").select("email").eq("id", user.id).single();
  return { userId: user.id, email: profile?.email ?? user.email ?? null };
}

/** Persist an audit event (uses service role when available for reliable writes). */
export async function auditLog(params: AuditLogInput & { req?: Request | null }) {
  const { req, ...rest } = params;
  const actor =
    rest.actorUserId !== undefined || rest.actorEmail !== undefined
      ? { userId: rest.actorUserId ?? null, email: rest.actorEmail ?? null }
      : await resolveActor(req);

  const row = {
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
    await db.from("audit_logs").insert(row);
  } catch (e) {
    console.error("[audit] insert failed:", e);
  }
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

export async function auditLogFromRequest(req: Request, params: Omit<AuditLogInput, "routePath" | "httpMethod" | "ipAddress" | "userAgent">) {
  const url = new URL(req.url);
  await auditLog({
    ...params,
    req,
    routePath: url.pathname,
    httpMethod: req.method,
  });
}
