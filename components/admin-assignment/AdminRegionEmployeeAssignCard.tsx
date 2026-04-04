"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Variant = "asset" | "vehicle" | "sim";

type EmpOpt = { id: string; full_name: string };

export function AdminRegionEmployeeAssignCard({
  variant,
  resourceId,
  regions,
  initialRegionId,
  statusLabel,
  canAssign,
}: {
  variant: Variant;
  resourceId: string;
  regions: { id: string; name: string }[];
  initialRegionId: string | null;
  statusLabel: string;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(initialRegionId ?? "");
  useEffect(() => {
    setRegionId(initialRegionId ?? "");
  }, [initialRegionId]);

  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!regionId) {
      setEmployees([]);
      setEmployeeId("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingEmployees(true);
      setError("");
      const res = await fetch(
        `/api/admin/region-assignees?region_id=${encodeURIComponent(regionId)}&variant=${encodeURIComponent(variant)}`
      );
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoadingEmployees(false);
      if (!res.ok) {
        setError(data.message || "Could not load employees");
        setEmployees([]);
        return;
      }
      const list = (data.employees ?? []) as EmpOpt[];
      setEmployees(list);
      setEmployeeId(list[0]?.id ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [regionId, variant]);

  const available =
    canAssign &&
    (variant === "sim" ? statusLabel === "Available" : statusLabel === "Available") &&
    !!regionId &&
    employees.length > 0 &&
    !!employeeId;

  async function onAssign() {
    if (!available || !regionId) return;
    setSaving(true);
    setError("");
    try {
      if (variant === "asset") {
        const res = await fetch(`/api/assets/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to_employee_id: employeeId,
            assignment_region_id: regionId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Assign failed");
      } else if (variant === "sim") {
        const res = await fetch(`/api/sims/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to_employee_id: employeeId,
            assignment_region_id: regionId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Assign failed");
      } else {
        const res = await fetch(`/api/vehicles/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            assignment_region_id: regionId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Assign failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setSaving(false);
    }
  }

  async function onUnassign() {
    setSaving(true);
    setError("");
    try {
      if (variant === "asset") {
        const res = await fetch(`/api/assets/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigned_to_employee_id: "" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Unassign failed");
      } else if (variant === "sim") {
        const res = await fetch(`/api/sims/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unassign: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Unassign failed");
      } else {
        const res = await fetch(`/api/vehicles/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unassign: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Unassign failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unassign failed");
    } finally {
      setSaving(false);
    }
  }

  const title =
    variant === "asset"
      ? "Assign to employee (by region)"
      : variant === "vehicle"
        ? "Assign to driver / rigger (by region)"
        : "Assign SIM (by region)";

  const assigned =
    variant === "asset"
      ? statusLabel === "Assigned"
      : variant === "sim"
        ? statusLabel === "Assigned"
        : statusLabel === "Assigned";

  const selectClass = "w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm bg-white";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-zinc-900">{title}</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Choose a region to filter eligible employees, then pick the person. Teams are still used elsewhere for visibility;
        assignment is always to an individual.
      </p>
      {!canAssign ? (
        <p className="text-sm text-zinc-500">You do not have permission to assign this resource.</p>
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
            <select className={selectClass} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">Select region…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {loadingEmployees ? (
            <p className="text-sm text-zinc-500">Loading employees…</p>
          ) : !regionId ? (
            <p className="text-sm text-zinc-500">Select a region to load eligible employees.</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-amber-800">
              No eligible employees in this region for this assignment type.
            </p>
          ) : (
            <div className="max-w-md">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
              <select className={selectClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!available || saving}
              onClick={onAssign}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : "Assign"}
            </button>
            {assigned ? (
              <button
                type="button"
                disabled={saving}
                onClick={onUnassign}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-40"
              >
                Unassign
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
