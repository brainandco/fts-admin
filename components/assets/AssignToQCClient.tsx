"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Asset = {
  id: string;
  name: string;
  category: string;
  model: string | null;
  serial: string | null;
  imei_1: string | null;
  imei_2: string | null;
  status: string;
};
type QC = { id: string; full_name: string };

export function AssignToQCClient({ assets, qcEmployees }: { assets: Asset[]; qcEmployees: QC[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qcId, setQcId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === assets.length) setSelected(new Set());
    else setSelected(new Set(assets.map((a) => a.id)));
  };

  async function assign() {
    setError("");
    setMessage("");
    if (selected.size === 0) {
      setError("Select at least one asset.");
      return;
    }
    if (!qcId.trim()) {
      setError("Select a QC.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/assets/assign-to-qc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_ids: [...selected], qc_employee_id: qcId }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data.message || "Failed to assign");
      return;
    }
    setMessage(data.message || `Assigned ${data.assigned ?? 0} to QC.`);
    setSelected(new Set());
    setQcId("");
    router.refresh();
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <p className="text-zinc-600">No available assets. Add assets first, then assign them to QC from here.</p>
        <p className="mt-2 text-sm text-zinc-500">Assets that are already assigned to a QC or to an employee do not appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-zinc-700">Assign to QC</label>
          <select value={qcId} onChange={(e) => setQcId(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
            <option value="">— Select QC</option>
            {qcEmployees.map((qc) => (
              <option key={qc.id} value={qc.id}>{qc.full_name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={assign}
          disabled={submitting || selected.size === 0 || !qcId}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? "Assigning…" : `Assign ${selected.size} selected to QC`}
        </button>
        {qcEmployees.length === 0 && <p className="text-sm text-amber-600">No QC employees found. Add employee with QC role first.</p>}
      </div>
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="w-10 px-4 py-3 text-left">
                <input type="checkbox" checked={selected.size === assets.length} onChange={toggleAll} className="rounded border-zinc-300" aria-label="Select all" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Serial</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Model</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">IMEI 1</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">IMEI 2</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Type</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="rounded border-zinc-300" />
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900">{a.serial ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-700">{a.model ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">{a.imei_1 ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">{a.imei_2 ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-900">{a.name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-600">{a.category ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
