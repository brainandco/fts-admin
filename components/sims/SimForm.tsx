"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SimCard = {
  id: string;
  operator: string;
  service_type: "Data" | "Voice" | "Data+Voice";
  sim_number: string;
  phone_number: string | null;
  status: string;
  notes: string | null;
} | null;

export function SimForm({ existing }: { existing: SimCard }) {
  const router = useRouter();
  const [operator, setOperator] = useState(existing?.operator ?? "");
  const [serviceType, setServiceType] = useState<"Data" | "Voice" | "Data+Voice">(existing?.service_type ?? "Data");
  const [simNumber, setSimNumber] = useState(existing?.sim_number ?? "");
  const [phoneNumber, setPhoneNumber] = useState(existing?.phone_number ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = existing ? `/api/sims/${existing.id}` : "/api/sims";
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operator: operator.trim(),
        service_type: serviceType,
        sim_number: simNumber.trim(),
        phone_number: phoneNumber.trim() || null,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save SIM");
      return;
    }
    const id = existing ? existing.id : data.id;
    router.push(id ? `/sims/${id}` : "/sims");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Operator</label>
        <input
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="e.g. Zain, STC, Mobily"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Service type</label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as "Data" | "Voice" | "Data+Voice")}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="Data">Data</option>
          <option value="Voice">Voice</option>
          <option value="Data+Voice">Data + Voice</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">SIM number</label>
        <input
          value={simNumber}
          onChange={(e) => setSimNumber(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono"
          placeholder="Unique SIM/ICCID number"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Phone number</label>
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Optional MSISDN"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Optional notes"
        />
      </div>
      {existing ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          Current status: <span className="font-medium text-zinc-900">{existing.status}</span> (employee assignment is handled by Project Managers)
        </p>
      ) : null}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : existing ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
