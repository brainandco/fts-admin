"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidTeamCodeFormat, normalizeTeamCode } from "@/lib/teams/teamCode";
import { ROLES_NOT_ALLOWED_ON_TEAM } from "@/lib/employees/employee-role-options";
import { SearchableSelect, type SearchableOption } from "@/components/ui/SearchableSelect";
import { FormActions, FormCallout, FormCard, FormCardSection, FormSection } from "@/components/ui/FormSection";

type Employee = { id: string; full_name: string; roles: string[]; region_id: string | null };
type Team = {
  id: string;
  name: string;
  team_code?: string | null;
  project_id: string | null;
  region_id: string | null;
  dt_employee_id: string | null;
  driver_rigger_employee_id: string | null;
  max_size: number | null;
  onboarding_date?: string | null;
} | null;

/**
 * Region and project on the team row are taken from the DT’s employee record when the team is saved.
 * Driver/Rigger must be in the same primary region as the DT.
 */
export function TeamForm({
  existing,
  employees,
  unavailableEmployeeIds,
  regionNamesById,
}: {
  existing: Team;
  employees: Employee[];
  unavailableEmployeeIds: string[];
  /** Region display names for auto TEAM-{REGION}-NN codes (new teams only). */
  regionNamesById?: Record<string, string>;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [teamCode, setTeamCode] = useState(
    existing?.team_code ? String(existing.team_code) : ""
  );
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
  const identityTouchedRef = useRef(false);
  const regionNamesByIdRef = useRef(regionNamesById);
  regionNamesByIdRef.current = regionNamesById;

  /** Field roles only: not QC/QA/PP/PM/PC or Other/custom roles. */
  const canBeOnTeam = (e: Employee) => !e.roles.some((r) => ROLES_NOT_ALLOWED_ON_TEAM.has(r));
  const selectable = useMemo(() => {
    const unavailableSet = new Set(unavailableEmployeeIds);
    return employees.filter((e) => {
      if (!canBeOnTeam(e)) return false;
      if (existing && (e.id === existing.dt_employee_id || e.id === existing.driver_rigger_employee_id)) return true;
      return !unavailableSet.has(e.id);
    });
  }, [employees, existing, unavailableEmployeeIds]);

  const employeesWithDt = useMemo(
    () =>
      selectable.filter(
        (e) => e.roles.includes("DT") && (e.region_id || (!!existing && e.id === existing.dt_employee_id))
      ),
    [selectable, existing]
  );
  const employeesWithDriverRigger = useMemo(
    () => selectable.filter((e) => e.roles.includes("Driver/Rigger")),
    [selectable]
  );
  const employeesWithSelfDt = useMemo(
    () =>
      selectable.filter(
        (e) =>
          e.roles.includes("Self DT") &&
          (e.region_id ||
            (!!existing &&
              e.id === existing.dt_employee_id &&
              existing.dt_employee_id === existing.driver_rigger_employee_id))
      ),
    [selectable, existing]
  );

  const dtRegionId = useMemo(() => {
    const e = selectable.find((x) => x.id === dtEmployeeId);
    return e?.region_id ?? null;
  }, [selectable, dtEmployeeId]);

  /** Region for the new team row (from DT or Self DT) — drives auto name/code. */
  const effectiveRegionId = useMemo(() => {
    if (existing) return null;
    if (isSelfDtTeam) {
      const e = selectable.find((x) => x.id === selfDtEmployeeId);
      return e?.region_id ?? null;
    }
    const e = selectable.find((x) => x.id === dtEmployeeId);
    return e?.region_id ?? null;
  }, [existing, isSelfDtTeam, selfDtEmployeeId, dtEmployeeId, selectable]);

  useEffect(() => {
    if (existing) return;
    if (!effectiveRegionId) {
      if (!identityTouchedRef.current) {
        setName("");
        setTeamCode("");
      }
      return;
    }
    const ac = new AbortController();
    const qs = new URLSearchParams({ region_id: effectiveRegionId });
    const rn = regionNamesByIdRef.current?.[effectiveRegionId];
    if (rn) qs.set("region_name", rn);
    (async () => {
      try {
        const res = await fetch(`/api/teams/next-code?${qs.toString()}`, { signal: ac.signal });
        const data = (await res.json()) as { code?: string };
        if (!res.ok) return;
        if (identityTouchedRef.current) return;
        const code = typeof data.code === "string" ? data.code : "";
        if (!code) return;
        setName(code);
        setTeamCode(code);
      } catch {
        /* aborted or network */
      }
    })();
    return () => ac.abort();
  }, [existing, effectiveRegionId]);

  const driversInDtRegion = useMemo(() => {
    if (!dtRegionId) {
      return driverRiggerEmployeeId
        ? employeesWithDriverRigger.filter((e) => e.id === driverRiggerEmployeeId)
        : [];
    }
    const inRegion = employeesWithDriverRigger.filter((e) => e.region_id === dtRegionId);
    if (driverRiggerEmployeeId && !inRegion.some((e) => e.id === driverRiggerEmployeeId)) {
      const cur = employeesWithDriverRigger.find((e) => e.id === driverRiggerEmployeeId);
      if (cur) return [...inRegion, cur];
    }
    return inRegion;
  }, [employeesWithDriverRigger, dtRegionId, driverRiggerEmployeeId]);

  const toOptions = (list: Employee[]): SearchableOption[] =>
    list.map((e) => ({ id: e.id, label: e.full_name }));

  const dtSelectedName = selectable.find((e) => e.id === dtEmployeeId)?.full_name ?? "";
  const drSelectedName = selectable.find((e) => e.id === driverRiggerEmployeeId)?.full_name ?? "";
  const selfDtSelectedName = selectable.find((e) => e.id === selfDtEmployeeId)?.full_name ?? "";

  const selectClass = "w-full rounded border border-zinc-300 px-3 py-2 text-sm";

  function handleDtSelected(option?: SearchableOption) {
    if (!option) return;
    setDtEmployeeId(option.id);
    const dr = selectable.find((e) => e.id === driverRiggerEmployeeId);
    const newDt = selectable.find((e) => e.id === option.id);
    if (dr && newDt?.region_id && dr.region_id !== newDt.region_id) {
      setDriverRiggerEmployeeId("");
    }
  }

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
    const codeNorm = normalizeTeamCode(teamCode);
    if (!codeNorm) {
      setError("Team code is required (unique identifier for segregating teams).");
      return;
    }
    if (!isValidTeamCodeFormat(codeNorm)) {
      setError("Team code must be 2–32 characters: letters, numbers, underscore, or hyphen (e.g. TEAM-01).");
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
        team_code: codeNorm,
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
    <form onSubmit={submit} className="max-w-3xl">
      <FormCard>
        <FormCardSection className="!py-5">
          <FormCallout variant="info" title="Region & project">
            The team&apos;s region and project come from the <strong>DT</strong> (or Self DT) employee — set them under{" "}
            <strong>People → Employee region &amp; project assignments</strong>. The Driver/Rigger must be in the{" "}
            <strong>same primary region</strong> as the DT.
          </FormCallout>
        </FormCardSection>

        <FormCardSection>
          <FormSection
            title="Team identity"
            description="Display name and unique code used in reports and filters."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => {
                    identityTouchedRef.current = true;
                    setName(e.target.value);
                  }}
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Team code <span className="text-red-600">*</span>
                </label>
                <input
                  value={teamCode}
                  onChange={(e) => {
                    identityTouchedRef.current = true;
                    setTeamCode(e.target.value);
                  }}
                  required
                  autoComplete="off"
                  placeholder="e.g. TEAM-EAST-01"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm uppercase shadow-sm placeholder:normal-case placeholder:font-sans focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  {existing
                    ? "2–32 characters; letters, numbers, underscore, hyphen. Stored uppercase."
                    : "Suggested from the DT/Self DT region (e.g. TEAM-EAST-01). Same value as name by default. 2–32 characters; stored uppercase."}
                </p>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Onboarding date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={onboardingDate}
                onChange={(e) => setOnboardingDate(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </FormSection>
        </FormCardSection>

        <FormCardSection>
          <FormSection
            title="Membership"
            description="Only DT, Driver/Rigger, or Self DT can be on a team. QC, QA, PP, PM, PC, and custom (Other) roles cannot be assigned here."
          >
            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-700">Team type</span>
              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="teamType"
                    checked={!isSelfDtTeam}
                    onChange={() => {
                      setIsSelfDtTeam(false);
                      setSelfDtEmployeeId("");
                    }}
                  />
                  Standard (DT + Driver/Rigger)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="teamType"
                    checked={isSelfDtTeam}
                    onChange={() => {
                      setIsSelfDtTeam(true);
                      setDtEmployeeId("");
                      setDriverRiggerEmployeeId("");
                    }}
                  />
                  Self DT (one person)
                </label>
              </div>
            </div>
      {isSelfDtTeam ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Self DT employee <span className="text-red-600">*</span>
          </label>
          <SearchableSelect
            options={toOptions(employeesWithSelfDt)}
            value={selfDtSelectedName}
            onChange={(_value, option) => {
              if (option) setSelfDtEmployeeId(option.id);
            }}
            placeholder="Type to search Self DT…"
            required
            className={selectClass}
            listClassName="max-h-72"
          />
          <p className="mt-1 text-xs text-zinc-500">
            One person acts as both DT and Driver/Rigger. They must have a primary region (and formal project if required for
            their role) on Employee region &amp; project assignments.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              DT (1 per team) <span className="text-red-600">*</span>
            </label>
            <SearchableSelect
              options={toOptions(employeesWithDt)}
              value={dtSelectedName}
              onChange={(_value, option) => {
                handleDtSelected(option);
              }}
              placeholder="Type to search DT…"
              required
              className={selectClass}
              listClassName="max-h-72"
            />
            <p className="mt-1 text-xs text-zinc-500">
              New teams: only DTs with a primary region are listed. When editing, the current DT always appears so you can
              replace them after fixing region in Employee assignments.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Driver/Rigger (1 per team) <span className="text-red-600">*</span>
            </label>
            <SearchableSelect
              options={toOptions(driversInDtRegion)}
              value={drSelectedName}
              onChange={(_value, option) => {
                if (option) setDriverRiggerEmployeeId(option.id);
              }}
              placeholder={
                dtEmployeeId
                  ? dtRegionId
                    ? "Type to search Driver/Rigger (same region as DT)…"
                    : "Selected DT has no region — fix in Employee region & project first."
                  : "Select a DT first…"
              }
              required
              className={selectClass}
              listClassName="max-h-72"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Only Driver/Riggers in the <strong>same region</strong> as the DT are shown.
            </p>
          </div>
        </>
      )}
          </FormSection>
        </FormCardSection>

        {error ? (
          <FormCardSection>
            <p className="text-sm text-red-600">{error}</p>
          </FormCardSection>
        ) : null}

        <FormActions>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : existing ? "Update" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </FormActions>
      </FormCard>
    </form>
  );
}
