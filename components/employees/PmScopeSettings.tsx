"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Region = { id: string; name: string };
type Project = { id: string; name: string; region_id: string };

export function PmScopeSettings({
  employeeId,
  isSuper,
  canEditProjects,
  isPm,
  primaryRegionId,
  allRegions,
  allProjects,
  extraRegionIds,
  projectIds,
}: {
  employeeId: string;
  isSuper: boolean;
  canEditProjects: boolean;
  isPm: boolean;
  primaryRegionId: string | null;
  allRegions: Region[];
  allProjects: Project[];
  extraRegionIds: string[];
  projectIds: string[];
}) {
  const router = useRouter();
  const [extraSel, setExtraSel] = useState<string[]>(extraRegionIds);
  const [projSel, setProjSel] = useState<string[]>(projectIds);
  const [savingRegions, setSavingRegions] = useState(false);
  const [savingProjects, setSavingProjects] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const regionOptions = useMemo(() => {
    return allRegions.filter((r) => r.id !== primaryRegionId);
  }, [allRegions, primaryRegionId]);

  async function saveExtraRegions() {
    setSavingRegions(true);
    setMsg(null);
    const res = await fetch(`/api/employees/${employeeId}/pm-extra-regions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_ids: extraSel }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingRegions(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.message || "Save failed" });
      return;
    }
    setMsg({ type: "ok", text: "Extra regions saved." });
    router.refresh();
  }

  async function saveProjects() {
    setSavingProjects(true);
    setMsg(null);
    const res = await fetch(`/api/employees/${employeeId}/pm-projects`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_ids: projSel }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingProjects(false);
    if (!res.ok) {
      setMsg({ type: "err", text: data.message || "Save failed" });
      return;
    }
    setMsg({ type: "ok", text: "PM projects saved." });
    router.refresh();
  }

  if (!isPm) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">Project Manager — scope (teams &amp; assignments)</h2>
      <p className="mt-1 text-sm text-zinc-600">
        In the employee portal, PMs see teams from: (1) all teams in their primary region and any extra regions below, (2) all teams on projects listed here, and (3) projects where their portal user is set as project PM (
        <code className="rounded bg-white px-1 text-xs">projects.pm_user_id</code>
        ). Primary region stays on{" "}
        <span className="font-medium text-zinc-800">Region &amp; project assignments</span>; it is not duplicated below.
      </p>

      {msg ? (
        <p className={`mt-3 text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      ) : null}

      {isSuper ? (
        <div className="mt-5 rounded-lg border border-white bg-white/80 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Extra regions (Super User only)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Rare: assign additional regions beyond the primary. Do not select the primary region here.
          </p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded border border-zinc-200 bg-white p-2">
            {regionOptions.length === 0 ? (
              <p className="text-sm text-zinc-500">No other regions.</p>
            ) : (
              regionOptions.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extraSel.includes(r.id)}
                    onChange={(e) => {
                      setExtraSel((prev) =>
                        e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                      );
                    }}
                  />
                  {r.name}
                </label>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => void saveExtraRegions()}
            disabled={savingRegions}
            className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {savingRegions ? "Saving…" : "Save extra regions"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Only a Super User can assign extra regions for a PM.</p>
      )}

      {canEditProjects ? (
        <div className="mt-5 rounded-lg border border-white bg-white/80 p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Projects for this PM</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Multiple projects let the PM see teams in the same region across different projects. Also set the portal user on each project as PM when applicable.
          </p>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded border border-zinc-200 bg-white p-2">
            {allProjects.length === 0 ? (
              <p className="text-sm text-zinc-500">No projects.</p>
            ) : (
              allProjects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={projSel.includes(p.id)}
                    onChange={(e) => {
                      setProjSel((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                      );
                    }}
                  />
                  {p.name}
                </label>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => void saveProjects()}
            disabled={savingProjects}
            className="mt-3 rounded bg-indigo-800 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-900 disabled:opacity-50"
          >
            {savingProjects ? "Saving…" : "Save projects"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">You do not have permission to edit PM project assignments.</p>
      )}
    </div>
  );
}
