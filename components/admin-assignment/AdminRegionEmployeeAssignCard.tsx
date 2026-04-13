"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableSelect, type SearchableOption } from "@/components/ui/SearchableSelect";

type Variant = "asset" | "vehicle" | "sim";

type EmpPick = { id: string; label: string };

export function AdminRegionEmployeeAssignCard({
  variant,
  resourceId,
  regions = [],
  initialRegionId,
  statusLabel,
  canAssign,
  employeeListScope = "region",
}: {
  variant: Variant;
  resourceId: string;
  regions?: { id: string; name: string }[];
  initialRegionId: string | null;
  statusLabel: string;
  canAssign: boolean;
  /** For assets: load all eligible employees; assignment region comes from the employee record / team. */
  employeeListScope?: "region" | "global";
}) {
  const router = useRouter();
  const isAssetGlobal = variant === "asset" && employeeListScope === "global";

  const [regionId, setRegionId] = useState(initialRegionId ?? "");
  useEffect(() => {
    setRegionId(initialRegionId ?? "");
  }, [initialRegionId]);

  const [employees, setEmployees] = useState<EmpPick[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAssetGlobal) {
      let cancelled = false;
      (async () => {
        setLoadingEmployees(true);
        setError("");
        const res = await fetch("/api/admin/asset-assignees");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setLoadingEmployees(false);
        if (!res.ok) {
          setError(data.message || "Could not load employees");
          setEmployees([]);
          setEmployeeId("");
          return;
        }
        const list = (data.employees ?? []) as { id: string; display_label: string }[];
        const picks: EmpPick[] = list.map((e) => ({ id: e.id, label: e.display_label }));
        setEmployees(picks);
        setEmployeeId(picks[0]?.id ?? "");
      })();
      return () => {
        cancelled = true;
      };
    }

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
      const list = (data.employees ?? []) as { id: string; full_name: string }[];
      const picks: EmpPick[] = list.map((e) => ({ id: e.id, label: e.full_name }));
      setEmployees(picks);
      setEmployeeId(picks[0]?.id ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [regionId, variant, isAssetGlobal]);

  const available =
    canAssign &&
    (variant === "sim" ? statusLabel === "Available" : statusLabel === "Available") &&
    !!employeeId &&
    employees.length > 0 &&
    (isAssetGlobal || !!regionId);

  async function onAssign() {
    if (!available) return;
    setSaving(true);
    setError("");
    try {
      if (variant === "asset") {
        const res = await fetch(`/api/assets/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isAssetGlobal
              ? { assigned_to_employee_id: employeeId }
              : {
                  assigned_to_employee_id: employeeId,
                  assignment_region_id: regionId,
                }
          ),
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
      ? isAssetGlobal
        ? "Assign to employee"
        : "Assign to employee (by region)"
      : variant === "vehicle"
        ? "Assign to driver / rigger (by region)"
        : "Assign SIM (by region)";

  const description = isAssetGlobal
    ? "Search and select an employee. The asset’s assignment region is set from their profile or team (DT) automatically."
    : "Choose a region to filter eligible employees, then pick the person. Teams are still used elsewhere for visibility; assignment is always to an individual.";

  const assigned =
    variant === "asset"
      ? statusLabel === "Assigned"
      : variant === "sim"
        ? statusLabel === "Assigned"
        : statusLabel === "Assigned";

  const selectClass = "w-full max-w-md rounded border border-zinc-300 px-3 py-2 text-sm bg-white";

  const regionOptions: SearchableOption[] = useMemo(
    () => regions.map((r) => ({ id: r.id, label: r.name })),
    [regions]
  );
  const regionLabel = regionId ? regions.find((r) => r.id === regionId)?.name ?? "" : "";

  const employeeOptions: SearchableOption[] = useMemo(
    () => employees.map((e) => ({ id: e.id, label: e.label })),
    [employees]
  );
  const employeeLabel = employeeId ? employees.find((e) => e.id === employeeId)?.label ?? "" : "";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-zinc-900">{title}</h2>
      <p className="mb-4 text-sm text-zinc-600">{description}</p>
      {!canAssign ? (
        <p className="text-sm text-zinc-500">You do not have permission to assign this resource.</p>
      ) : (
        <>
          {!isAssetGlobal ? (
            <div className="mb-4 max-w-md">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
              <SearchableSelect
                options={regionOptions}
                value={regionLabel}
                onChange={(_value, option) => {
                  if (option) setRegionId(option.id);
                }}
                placeholder="Type to search or select region…"
                className={selectClass}
                listClassName="max-h-60"
              />
            </div>
          ) : null}
          {loadingEmployees ? (
            <p className="text-sm text-zinc-500">Loading employees…</p>
          ) : !isAssetGlobal && !regionId ? (
            <p className="text-sm text-zinc-500">Select a region to load eligible employees.</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-amber-800">
              {isAssetGlobal
                ? "No eligible employees found for asset assignment (DT / Self DT in a region)."
                : "No eligible employees in this region for this assignment type."}
            </p>
          ) : (
            <div className="max-w-md">
              <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
              <SearchableSelect
                options={employeeOptions}
                value={employeeLabel}
                onChange={(_value, option) => {
                  if (option) setEmployeeId(option.id);
                }}
                placeholder="Type to search or select employee…"
                className={selectClass}
                listClassName="max-h-72"
              />
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
