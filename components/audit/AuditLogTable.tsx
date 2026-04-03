"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Log = { id: string; timestamp: string; actor_email: string | null; action_type: string; entity_type: string; entity_id: string | null; description: string | null };

export function AuditLogTable({ logs, searchParams }: { logs: Log[]; searchParams: Record<string, string | undefined> }) {
  const router = useRouter();
  const sp = useSearchParams();

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push("/audit?" + next.toString());
  }

  function exportCsv() {
    const headers = ["timestamp", "actor_email", "action_type", "entity_type", "entity_id", "description"];
    const rows = logs.map((l) => [l.timestamp, l.actor_email ?? "", l.action_type, l.entity_type, l.entity_id ?? "", l.description ?? ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded border border-zinc-200 bg-white p-4">
        <div>
          <label className="mr-2 text-sm text-zinc-600">Entity type</label>
          <select value={searchParams.entity_type ?? ""} onChange={(e) => updateFilter("entity_type", e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm">
            <option value="">All</option>
            <option value="user">user</option>
            <option value="region">region</option>
            <option value="project">project</option>
            <option value="team">team</option>
            <option value="task">task</option>
            <option value="approval">approval</option>
            <option value="asset">asset</option>
            <option value="vehicle">vehicle</option>
          </select>
        </div>
        <div>
          <label className="mr-2 text-sm text-zinc-600">From</label>
          <input type="date" value={searchParams.from ?? ""} onChange={(e) => updateFilter("from", e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="mr-2 text-sm text-zinc-600">To</label>
          <input type="date" value={searchParams.to ?? ""} onChange={(e) => updateFilter("to", e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm" />
        </div>
        <button type="button" onClick={exportCsv} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="px-4 py-2 text-left font-medium">Time</th>
              <th className="px-4 py-2 text-left font-medium">Actor</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Entity</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-4 py-2">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2">{l.actor_email ?? "—"}</td>
                <td className="px-4 py-2">{l.action_type}</td>
                <td className="px-4 py-2">{l.entity_type} {l.entity_id ? `#${l.entity_id.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2">{l.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
