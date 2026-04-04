"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminTeamRegionEmployeePicker } from "./AdminTeamRegionEmployeePicker";
import type { TeamMemberPick } from "@/lib/admin-assignment/team-region-lists";

type Variant = "asset" | "vehicle" | "sim";

export function AdminRegionTeamAssignCard({
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
  /** e.g. asset status — must be Available for assign */
  statusLabel: string;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(initialRegionId ?? "");
  useEffect(() => {
    setRegionId(initialRegionId ?? "");
  }, [initialRegionId]);
  const [teams, setTeams] = useState<TeamMemberPick[]>([]);
  const [pick, setPick] = useState({ teamId: "", employeeId: "" });
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!regionId) {
      setTeams([]);
      setPick({ teamId: "", employeeId: "" });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTeams(true);
      setError("");
      const res = await fetch(
        `/api/admin/region-assignees?region_id=${encodeURIComponent(regionId)}&variant=${encodeURIComponent(variant)}`
      );
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoadingTeams(false);
      if (!res.ok) {
        setError(data.message || "Could not load team list");
        setTeams([]);
        return;
      }
      const t = (data.teams ?? []) as TeamMemberPick[];
      setTeams(t);
      const first = t[0];
      if (first?.members[0]) {
        setPick({ teamId: first.teamId, employeeId: first.members[0].id });
      } else {
        setPick({ teamId: first?.teamId ?? "", employeeId: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regionId, variant]);

  const available =
    canAssign &&
    (variant === "sim" ? statusLabel === "Available" : statusLabel === "Available") &&
    !!regionId &&
    teams.length > 0 &&
    !!pick.employeeId;

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
            assigned_to_employee_id: pick.employeeId,
            assignment_region_id: regionId,
            target_team_id: pick.teamId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Assign failed");
      } else if (variant === "sim") {
        const res = await fetch(`/api/sims/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to_employee_id: pick.employeeId,
            assignment_region_id: regionId,
            target_team_id: pick.teamId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Assign failed");
      } else {
        const res = await fetch(`/api/vehicles/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: pick.employeeId,
            assignment_region_id: regionId,
            target_team_id: pick.teamId,
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
      ? "Assign by team or region"
      : variant === "vehicle"
        ? "Assign driver / rigger (by team or region)"
        : "Assign SIM (by team or region)";

  const assigned =
    variant === "asset"
      ? statusLabel === "Assigned"
      : variant === "sim"
        ? statusLabel === "Assigned"
        : statusLabel === "Assigned";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-medium text-zinc-900">{title}</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Choose a region, then a team (or &quot;other in region&quot;), then the employee. The list matches who can receive this
        resource type in the employee portal.
      </p>
      {!canAssign ? (
        <p className="text-sm text-zinc-500">You do not have permission to assign this resource.</p>
      ) : (
        <>
          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
            <select
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm bg-white"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              <option value="">Select region…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {loadingTeams ? (
            <p className="text-sm text-zinc-500">Loading teams…</p>
          ) : (
            <AdminTeamRegionEmployeePicker
              teams={teams}
              disabled={!regionId}
              disabledReason="Select a region to load teams and employees."
              value={pick}
              onChange={setPick}
            />
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
