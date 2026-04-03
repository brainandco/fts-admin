import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function EntityHistory({
  entityType,
  entityId,
  showTitle = true,
}: {
  entityType: string;
  entityId: string;
  /** When false, no heading is rendered (e.g. when parent already has a card title). */
  showTitle?: boolean;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, timestamp, actor_email, action_type, description, old_value_json, new_value_json")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("timestamp", { ascending: false })
    .limit(50);

  return (
    <section>
      {showTitle && <h2 className="mb-3 text-lg font-medium text-zinc-900">History</h2>}
      {!logs?.length ? (
        <p className="text-sm text-zinc-500">No activity recorded yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-100">
          {logs.map((log) => (
            <li key={log.id} className="px-4 py-3 text-sm">
              <span className="font-medium text-zinc-700">{log.action_type}</span>
              {log.description && <span className="text-zinc-500"> — {log.description}</span>}
              <span className="ml-2 text-zinc-400">
                {log.actor_email} · {new Date(log.timestamp).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
