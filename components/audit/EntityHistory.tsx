import { createServerSupabaseClient } from "@/lib/supabase/server";

function actionBadgeClass(actionType: string): string {
  const a = actionType.toLowerCase();
  if (a.includes("reject")) return "bg-red-50 text-red-800 ring-red-200/60";
  if (a.includes("approve")) return "bg-emerald-50 text-emerald-800 ring-emerald-200/60";
  if (a.includes("create") || a.includes("insert")) return "bg-sky-50 text-sky-800 ring-sky-200/60";
  if (a.includes("update") || a.includes("edit")) return "bg-amber-50 text-amber-900 ring-amber-200/60";
  if (a.includes("delete")) return "bg-zinc-200 text-zinc-800 ring-zinc-300/80";
  return "bg-indigo-50 text-indigo-800 ring-indigo-200/60";
}

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
    <section
      className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5"
      aria-labelledby={showTitle ? "entity-history-heading" : undefined}
    >
      {showTitle ? (
        <div className="border-b border-zinc-100 bg-gradient-to-r from-zinc-50/90 to-indigo-50/40 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="entity-history-heading" className="text-base font-semibold tracking-tight text-zinc-900">
              Activity history
            </h2>
            {logs?.length ? (
              <span className="text-xs font-medium text-zinc-500">{logs.length} event{logs.length === 1 ? "" : "s"}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-600">Audit trail for this record.</p>
        </div>
      ) : null}

      <div className={`px-5 sm:px-6 ${showTitle ? "py-4" : "py-5"}`}>
        {!logs?.length ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-12 text-center">
            <p className="text-sm font-medium text-zinc-600">No activity yet</p>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">Changes and decisions will appear here when they occur.</p>
          </div>
        ) : (
          <ul className="relative space-y-0">
            {logs.map((log, i) => (
              <li key={log.id} className="relative flex gap-4 pb-8 last:pb-0">
                {i < logs.length - 1 ? (
                  <span
                    className="absolute left-[7px] top-4 h-[calc(100%-0.25rem)] w-px bg-gradient-to-b from-zinc-200 to-zinc-100"
                    aria-hidden
                  />
                ) : null}
                <span
                  className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-indigo-500 shadow-sm ring-2 ring-indigo-100"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 rounded-xl border border-zinc-100 bg-zinc-50/40 px-4 py-3 transition-colors hover:bg-zinc-50/80">
                  <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                    <span
                      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${actionBadgeClass(log.action_type)}`}
                    >
                      {log.action_type.replace(/_/g, " ")}
                    </span>
                    <time
                      dateTime={log.timestamp}
                      className="shrink-0 text-xs tabular-nums text-zinc-500"
                    >
                      {new Date(log.timestamp).toLocaleString()}
                    </time>
                  </div>
                  {log.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700">{log.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600">{log.actor_email ?? "System"}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
