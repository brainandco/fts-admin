"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type Region = { id: string; name: string };
type Project = { id: string; name: string };
type VehicleOption = { id: string; plate_number: string; name: string | null };
type EmployeeOption = { id: string; full_name: string; phone: string | null; email: string | null; designation: string | null; project_id: string | null; region_id: string | null };

export function AssignVehicleForm({
  initialVehicleId,
  vehicles,
  regions,
  projects,
}: {
  initialVehicleId: string | null;
  vehicles: VehicleOption[];
  regions: Region[];
  projects: Project[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [vehicleDisplay, setVehicleDisplay] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [contact, setContact] = useState("");
  const [projectId, setProjectId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialVehicleId) {
      setVehicleId(initialVehicleId);
      const v = vehicles.find((x) => x.id === initialVehicleId);
      if (v) setVehicleDisplay(v.plate_number);
    }
  }, [initialVehicleId, vehicles]);

  useEffect(() => {
    fetch("/api/employees/for-vehicle")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees ?? []))
      .catch(() => setEmployees([]));
  }, []);

  const vehicleOptions = vehicles.map((v) => ({ ...v, id: v.id, label: v.plate_number }));
  const employeeOptions = employees.map((e) => ({ ...e, id: e.id, label: e.full_name }));

  function handleVehicleSelect(value: string, option?: { id?: string; plate_number?: string }) {
    if (option?.id !== undefined) {
      setVehicleId(option.id);
      setVehicleDisplay(option.plate_number ?? value);
    } else {
      setVehicleDisplay(value);
      setVehicleId("");
    }
  }

  function handleEmployeeSelect(value: string, option?: { id?: string; phone?: string | null; email?: string | null; designation?: string | null; project_id?: string | null; region_id?: string | null }) {
    setName(value);
    setEmployeeId(option?.id ?? "");
    if (option) {
      setContact((option.phone || option.email) ?? "");
      setDesignation(option.designation ?? "");
      setProjectId(option.project_id ?? "");
      setRegionId(option.region_id ?? "");
    }
  }

  const projectName = projectId ? (projects.find((p) => p.id === projectId)?.name ?? "—") : "—";
  const regionName = regionId ? (regions.find((r) => r.id === regionId)?.name ?? "—") : "—";
  const disabledClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:cursor-not-allowed text-zinc-700";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!vehicleId) {
      setError("Select a vehicle.");
      return;
    }
    if (!employeeId) {
      setError("Select an employee to assign.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to assign");
      return;
    }
    router.push(`/vehicles/${vehicleId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-medium text-zinc-900">Assign vehicle to employee</h2>
      <p className="text-sm text-zinc-500">Choose a vehicle and an employee. The vehicle record will be updated with the employee&apos;s details.</p>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Vehicle (plate number) <span className="text-red-600">*</span></label>
        <SearchableSelect
          options={vehicleOptions}
          value={vehicleDisplay}
          onChange={handleVehicleSelect}
          placeholder="Search by vehicle plate number…"
          getOptionLabel={(o) => o.label ?? ""}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Employee (assignee) <span className="text-red-600">*</span></label>
        <SearchableSelect
          options={employeeOptions}
          value={name}
          onChange={(value, option) => handleEmployeeSelect(value, option)}
          placeholder="Select employee"
          getOptionLabel={(o) => o.label ?? ""}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Designation</label>
        <input value={designation} readOnly disabled className={disabledClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Contact</label>
        <input value={contact} readOnly disabled className={disabledClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Project</label>
        <input value={projectName} readOnly disabled className={disabledClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
        <input value={regionName} readOnly disabled className={disabledClass} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">{saving ? "Assigning…" : "Assign"}</button>
        <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
      </div>
    </form>
  );
}
