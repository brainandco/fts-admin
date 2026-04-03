import { Suspense } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { AuditLogTable } from "@/components/audit/AuditLogTable";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_type?: string; entity_id?: string; from?: string; to?: string }>;
}) {
  if (!(await can("audit_logs.view_all"))) redirect("/dashboard");
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("audit_logs").select("id, timestamp, actor_email, action_type, entity_type, entity_id, description").order("timestamp", { ascending: false }).limit(200);
  if (params.entity_type) query = query.eq("entity_type", params.entity_type);
  if (params.entity_id) query = query.eq("entity_id", params.entity_id);
  if (params.from) query = query.gte("timestamp", params.from);
  if (params.to) query = query.lte("timestamp", params.to);
  const { data: logs } = await query;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Audit logs</h1>
      <Suspense fallback={<div className="text-zinc-500">Loading…</div>}>
        <AuditLogTable logs={logs ?? []} searchParams={params} />
      </Suspense>
    </div>
  );
}
