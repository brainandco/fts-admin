"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Sim = {
  id: string;
  operator: string;
  service_type: string;
  sim_number: string;
  phone_number: string | null;
  status: string;
};

type Employee = { id: string; full_name: string };

export function AssignSimsClient({
  sims,
  employees,
}: {
  sims: Sim[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sims.length) setSelected(new Set());
    else setSelected(new Set(sims.map((s) => s.id)));
  }

  async function assign() {
    setError("");
    setMessage("");
    if (!employeeId) return setError("Select an employee.");
    if (selected.size === 0) return setError("Select at least one SIM.");

    setLoading(true);
    const res = await fetch("/api/sims/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sim_ids: [...selected],
        employee_id: employeeId,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.message || "Failed to assign SIM(s)");
    setMessage(data.message || "Assigned");
    setSelected(new Set());
    setNotes("");
    router.refresh();
  }

  if (sims.length === 0) {
    return <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No available SIM cards.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Optional assignment note"
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={assign}
            disabled={loading || selected.size === 0}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Assigning..." : `Assign ${selected.size} selected`}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="w-10 px-4 py-3 text-left">
                <input type="checkbox" checked={selected.size === sims.length} onChange={toggleAll} className="rounded border-zinc-300" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">SIM number</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Operator</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Service</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Phone number</th>
            </tr>
          </thead>
          <tbody>
            {sims.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="rounded border-zinc-300" />
                </td>
                <td className="px-4 py-3 font-mono">{s.sim_number}</td>
                <td className="px-4 py-3">{s.operator}</td>
                <td className="px-4 py-3">{s.service_type}</td>
                <td className="px-4 py-3">{s.phone_number ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
