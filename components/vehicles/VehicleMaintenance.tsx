"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Log = { id: string; service_date: string; service_type: string | null; mileage_at_service: number | null; cost: number | null; notes: string | null; vendor: string | null };

export function VehicleMaintenance({ vehicleId, logs }: { vehicleId: string; logs: Log[] }) {
  const router = useRouter();
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [mileageAtService, setMileageAtService] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [vendor, setVendor] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/vehicles/${vehicleId}/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_date: serviceDate,
        service_type: serviceType || null,
        mileage_at_service: mileageAtService ? parseInt(mileageAtService, 10) : null,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
        vendor: vendor || null,
      }),
    });
    setServiceDate(""); setServiceType(""); setMileageAtService(""); setCost(""); setNotes(""); setVendor("");
    setSaving(false);
    router.refresh();
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium text-zinc-900">Maintenance logs</h2>
      <form onSubmit={add} className="mb-4 grid grid-cols-2 gap-2 rounded border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-4">
        <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Date" />
        <input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Type" />
        <input type="number" value={mileageAtService} onChange={(e) => setMileageAtService(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Mileage" />
        <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Cost" />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Vendor" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Notes" />
        <button type="submit" disabled={saving || !serviceDate} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">Add log</button>
      </form>
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Mileage</th>
              <th className="px-4 py-2 text-left font-medium">Cost</th>
              <th className="px-4 py-2 text-left font-medium">Vendor</th>
              <th className="px-4 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-4 py-2">{new Date(l.service_date).toLocaleDateString()}</td>
                <td className="px-4 py-2">{l.service_type ?? "—"}</td>
                <td className="px-4 py-2">{l.mileage_at_service ?? "—"}</td>
                <td className="px-4 py-2">{l.cost != null ? l.cost : "—"}</td>
                <td className="px-4 py-2">{l.vendor ?? "—"}</td>
                <td className="px-4 py-2">{l.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
