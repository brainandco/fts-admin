"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Vehicle = {
  id: string;
  plate_number: string;
  vehicle_type: string | null;
  rent_company: string | null;
  make: string | null;
  model: string | null;
  assignment_type?: "Temporary" | "Permanent" | null;
  status: string;
} | null;

/** Form for adding or editing vehicle details only. No assignment, no project/region. */
export function VehicleForm({
  existing,
  regions,
  projects,
}: {
  existing: Vehicle;
  regions: { id: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState(existing?.plate_number ?? "");
  const [vehicleType, setVehicleType] = useState(existing?.vehicle_type ?? "");
  const [rentCompany, setRentCompany] = useState(existing?.rent_company ?? "");
  const [make, setMake] = useState(existing?.make ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [assignmentType, setAssignmentType] = useState<"Temporary" | "Permanent">(
    existing?.assignment_type === "Temporary" ? "Temporary" : "Permanent"
  );
  const [status, setStatus] = useState(existing?.status ?? "Available");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url = existing ? `/api/vehicles/${existing.id}` : "/api/vehicles";
    const body = {
      plate_number: plateNumber.trim(),
      vehicle_type: vehicleType.trim() || null,
      rent_company: rentCompany.trim() || null,
      make: make.trim() || null,
      model: model.trim() || null,
      assignment_type: assignmentType,
      status,
    };
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.push(existing ? `/vehicles/${existing.id}` : "/vehicles");
    router.refresh();
  }

  const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Vehicle plate no. <span className="text-red-600">*</span></label>
        <input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Vehicle type</label>
        <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Sedan, Pickup" className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Rent company</label>
        <input value={rentCompany} onChange={(e) => setRentCompany(e.target.value)} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Make</label>
          <input value={make} onChange={(e) => setMake(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Assignment type</label>
        <div className="flex gap-6 rounded border border-zinc-300 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="assignment_type"
              value="Permanent"
              checked={assignmentType === "Permanent"}
              onChange={() => setAssignmentType("Permanent")}
            />
            Permanent
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="assignment_type"
              value="Temporary"
              checked={assignmentType === "Temporary"}
              onChange={() => setAssignmentType("Temporary")}
            />
            Temporary
          </label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Under_Maintenance">Under Maintenance</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Update" : "Create"}</button>
        <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
      </div>
    </form>
  );
}
