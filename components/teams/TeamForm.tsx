"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Employee = { id: string; full_name: string; roles: string[] };
type Team = {
  id: string;
  name: string;
  project_id: string | null;
  region_id: string | null;
  dt_employee_id: string | null;
  driver_rigger_employee_id: string | null;
  max_size: number | null;
  onboarding_date?: string | null;
} | null;

/** Members & name only — region and project are set on Teams → Region & project assignments. */
export function TeamForm({
  existing,
  employees,
  unavailableEmployeeIds,
}: {
  existing: Team;
  employees: Employee[];
  unavailableEmployeeIds: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [dtEmployeeId, setDtEmployeeId] = useState(existing?.dt_employee_id ?? "");
  const [driverRiggerEmployeeId, setDriverRiggerEmployeeId] = useState(existing?.driver_rigger_employee_id ?? "");
  const isExistingSelfDt = Boolean(
    existing?.dt_employee_id && existing?.driver_rigger_employee_id && existing.dt_employee_id === existing.driver_rigger_employee_id
  );
  const [selfDtEmployeeId, setSelfDtEmployeeId] = useState(isExistingSelfDt ? (existing!.dt_employee_id ?? "") : "");
  const [isSelfDtTeam, setIsSelfDtTeam] = useState(isExistingSelfDt);
  const [onboardingDate, setOnboardingDate] = useState(
    (existing as { onboarding_date?: string } | null)?.onboarding_date?.toString().slice(0, 10) ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unavailableSet = new Set(unavailableEmployeeIds);
  /** QC, QA, PP, and PM cannot be on a team (DT / Driver-Rigger / Self-DT slots). */
  const canBeOnTeam = (e: Employee) =>
    !e.roles.includes("QC") && !e.roles.includes("QA") && !e.roles.includes("PP") && !e.roles.includes("Project Manager");
  const selectable = employees.filter((e) => {
    if (!canBeOnTeam(e)) return false;
    if (existing && (e.id === existing.dt_employee_id || e.id === existing.driver_rigger_employee_id)) return true;
    return !unavailableSet.has(e.id);
  });
  const employeesWithDt = selectable.filter((e) => e.roles.includes("DT"));
  const employeesWithDriverRigger = selectable.filter((e) => e.roles.includes("Driver/Rigger"));
  const employeesWithSelfDt = selectable.filter((e) => e.roles.includes("Self DT"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let finalDtId: string;
    let finalDrId: string;
    if (isSelfDtTeam) {
      if (!selfDtEmployeeId) {
        setError("Select the Self DT employee.");
        return;
      }
      finalDtId = selfDtEmployeeId;
      finalDrId = selfDtEmployeeId;
    } else {
      if (!dtEmployeeId || !driverRiggerEmployeeId) {
        setError("Both DT and Driver/Rigger must be selected.");
        return;
      }
      finalDtId = dtEmployeeId;
      finalDrId = driverRiggerEmployeeId;
    }
    if (!name.trim()) {
      setError("Team name is required.");
      return;
    }
    if (!onboardingDate.trim()) {
      setError("Onboarding date is required.");
      return;
    }
    setSaving(true);
    const url = existing ? `/api/teams/${existing.id}` : "/api/teams";
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        dt_employee_id: finalDtId,
        driver_rigger_employee_id: finalDrId,
        max_size: isSelfDtTeam ? 1 : 2,
        onboarding_date: onboardingDate.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.push("/teams");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <p className="text-sm text-zinc-600">
        After creating the team, use <strong>Teams → Region &amp; project assignments</strong> (Super User) to assign region and project.
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Name <span className="text-red-600">*</span>
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Onboarding date <span className="text-red-600">*</span>
        </label>
        <input
          type="date"
          value={onboardingDate}
          onChange={(e) => setOnboardingDate(e.target.value)}
          required
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Team type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="teamType" checked={!isSelfDtTeam} onChange={() => setIsSelfDtTeam(false)} />
            Standard (DT + Driver/Rigger)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="teamType" checked={isSelfDtTeam} onChange={() => setIsSelfDtTeam(true)} />
            Self DT (one person)
          </label>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Only DT, Driver/Rigger, or Self DT can be members. QC, QA, PP, and Project Manager cannot be on a team.
      </p>
      {isSelfDtTeam ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Self DT employee <span className="text-red-600">*</span>
          </label>
          <select
            value={selfDtEmployeeId}
            onChange={(e) => setSelfDtEmployeeId(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">— Select Self DT —</option>
            {employeesWithSelfDt.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">One person acts as both DT and Driver/Rigger for this team.</p>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              DT (1 per team) <span className="text-red-600">*</span>
            </label>
            <select
              value={dtEmployeeId}
              onChange={(e) => setDtEmployeeId(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— Select DT —</option>
              {employeesWithDt.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Driver/Rigger (1 per team) <span className="text-red-600">*</span>
            </label>
            <select
              value={driverRiggerEmployeeId}
              onChange={(e) => setDriverRiggerEmployeeId(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— Select Driver/Rigger —</option>
              {employeesWithDriverRigger.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {saving ? "Saving…" : existing ? "Update" : "Create"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
