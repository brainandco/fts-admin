import { createServerSupabaseClient } from "@/lib/supabase/server";

type EntityType =
  | "user"
  | "employee"
  | "region"
  | "project"
  | "team"
  | "task"
  | "approval"
  | "asset"
  | "sim_card"
  | "vehicle"
  | "vehicle_maintenance"
  | "role"
  | "permission";

export async function auditLog(params: {
  actionType: string;
  entityType: EntityType;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  description?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users_profile").select("email").eq("id", user.id).single()
    : { data: null };

  await supabase.from("audit_logs").insert({
    actor_user_id: user?.id ?? null,
    actor_email: profile?.email ?? user?.email ?? null,
    action_type: params.actionType,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    old_value_json: params.oldValue ?? null,
    new_value_json: params.newValue ?? null,
    description: params.description ?? null,
    meta: params.meta ?? null,
  });
}
