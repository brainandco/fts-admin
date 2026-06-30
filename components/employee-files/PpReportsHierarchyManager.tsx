"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  PpReportAccountRow,
  PpReportOperatorRow,
  PpReportProjectRow,
} from "@/lib/pp-reports/folder-hierarchy";
import { stickyActionsTdClass, stickyActionsThClassRight } from "@/components/ui/table-sticky-actions";

type HierarchyData = {
  operators: PpReportOperatorRow[];
  accounts: PpReportAccountRow[];
  projects: PpReportProjectRow[];
};

export function PpReportsHierarchyManager() {
  const [data, setData] = useState<HierarchyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [opName, setOpName] = useState("");
  const [acctName, setAcctName] = useState("");
  const [projName, setProjName] = useState("");
  const [projOperatorId, setProjOperatorId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pp-reports-hierarchy");
      const json = (await res.json().catch(() => ({}))) as HierarchyData & { message?: string };
      if (!res.ok) throw new Error(json.message || "Failed to load");
      setData({ operators: json.operators ?? [], accounts: json.accounts ?? [], projects: json.projects ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function postJson(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || "Request failed");
      setMsg("Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchRow(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || "Update failed");
      setMsg("Updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRow(url: string, label: string) {
    if (!globalThis.confirm(`Delete “${label}”? Existing S3 folders are not removed.`)) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || "Delete failed");
      setMsg("Deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading hierarchy…</p>;

  const operators = data?.operators ?? [];
  const accounts = data?.accounts ?? [];
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}
      {msg && !error ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{msg}</div>
      ) : null}

      <p className="text-sm text-zinc-600">
        PP and Reporting Team members must create final-report folders as{" "}
        <strong>Region → Operator → Account → Project</strong>. Regions come from the main Regions list in the admin portal.
        Operator, account, and project names below must match folder names in Wasabi exactly. Deactivating hides an option
        from dropdowns without deleting existing folders.
      </p>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Operators</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/pp-reports-hierarchy/operators", { name: opName }).then(() => setOpName(""));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            New operator
            <input
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              className="min-w-[160px] rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. STC"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !opName.trim()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add operator
          </button>
        </form>
        <HierarchyTable
          rows={operators.map((o) => ({
            id: o.id,
            cells: [o.name, String(o.sort_order), o.is_active ? "Yes" : "No"],
            label: o.name,
          }))}
          headers={["Name", "Sort", "Active"]}
          busy={busy}
          onToggleActive={(id) => {
            const row = operators.find((o) => o.id === id);
            if (row) void patchRow(`/api/pp-reports-hierarchy/operators/${id}`, { is_active: !row.is_active });
          }}
          onDelete={(id, label) => void deleteRow(`/api/pp-reports-hierarchy/operators/${id}`, label)}
          activeKey={(row) => operators.find((o) => o.id === row.id)?.is_active ?? true}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Accounts</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/pp-reports-hierarchy/accounts", { name: acctName }).then(() => setAcctName(""));
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            New account
            <input
              value={acctName}
              onChange={(e) => setAcctName(e.target.value)}
              className="min-w-[160px] rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. Rollout"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !acctName.trim()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add account
          </button>
        </form>
        <HierarchyTable
          rows={accounts.map((a) => ({
            id: a.id,
            cells: [a.name, String(a.sort_order), a.is_active ? "Yes" : "No"],
            label: a.name,
          }))}
          headers={["Name", "Sort", "Active"]}
          busy={busy}
          onToggleActive={(id) => {
            const row = accounts.find((a) => a.id === id);
            if (row) void patchRow(`/api/pp-reports-hierarchy/accounts/${id}`, { is_active: !row.is_active });
          }}
          onDelete={(id, label) => void deleteRow(`/api/pp-reports-hierarchy/accounts/${id}`, label)}
          activeKey={(row) => accounts.find((a) => a.id === row.id)?.is_active ?? true}
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Projects</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void postJson("/api/pp-reports-hierarchy/projects", {
              name: projName,
              operator_id: projOperatorId,
            }).then(() => {
              setProjName("");
            });
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Operator
            <select
              value={projOperatorId}
              onChange={(e) => setProjOperatorId(e.target.value)}
              className="min-w-[140px] rounded border border-zinc-300 px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">Select…</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
            Project name
            <input
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. Saudi STC Trial"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !projName.trim() || !projOperatorId}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add project
          </button>
        </form>
        <HierarchyTable
          rows={projects.map((p) => ({
            id: p.id,
            cells: [p.operator_name ?? "—", p.name, String(p.sort_order), p.is_active ? "Yes" : "No"],
            label: p.name,
          }))}
          headers={["Operator", "Project", "Sort", "Active"]}
          busy={busy}
          onToggleActive={(id) => {
            const row = projects.find((p) => p.id === id);
            if (row) void patchRow(`/api/pp-reports-hierarchy/projects/${id}`, { is_active: !row.is_active });
          }}
          onDelete={(id, label) => void deleteRow(`/api/pp-reports-hierarchy/projects/${id}`, label)}
          activeKey={(row) => projects.find((p) => p.id === row.id)?.is_active ?? true}
        />
      </section>
    </div>
  );
}

function HierarchyTable({
  headers,
  rows,
  busy,
  onToggleActive,
  onDelete,
  activeKey,
}: {
  headers: string[];
  rows: { id: string; cells: string[]; label: string }[];
  busy: boolean;
  onToggleActive: (id: string, active: boolean, label: string) => void;
  onDelete: (id: string, label: string) => void;
  activeKey: (row: { id: string }) => boolean;
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">No entries yet.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-100">
      <table className="w-full min-w-[400px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-zinc-800">
                {h}
              </th>
            ))}
            <th className={stickyActionsThClassRight}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = activeKey(row);
            return (
              <tr key={row.id} className="group border-b border-zinc-100">
                {row.cells.map((c, i) => (
                  <td key={i} className="px-3 py-2 text-zinc-800">
                    {c}
                  </td>
                ))}
                <td className={`${stickyActionsTdClass({ align: "right", compact: true })} whitespace-nowrap`}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onToggleActive(row.id, active, row.label)}
                    className="text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {active ? "Deactivate" : "Activate"}
                  </button>
                  {" · "}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDelete(row.id, row.label)}
                    className="text-rose-600 hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
