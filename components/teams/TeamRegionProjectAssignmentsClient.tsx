"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TeamRow = {
  id: string;
  name: string;
  region_id: string | null;
  project_id: string | null;
};

type Region = { id: string; name: string };
type Project = { id: string; name: string; region_id: string };

export function TeamRegionProjectAssignmentsClient({
  teams,
  regions,
  projects,
}: {
  teams: TeamRow[];
  regions: Region[];
  projects: Project[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const projectsForRegion = useMemo(() => {
    if (!regionId) return [];
    return projects.filter((p) => p.region_id === regionId);
  }, [projects, regionId]);

  function startEdit(row: TeamRow) {
    setEditingId(row.id);
    setRegionId(row.region_id ?? "");
    setProjectId(row.project_id ?? "");
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setMessage(null);
  }

  async function save(teamId: string) {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/teams/${teamId}/assignment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region_id: regionId || null,
        project_id: projectId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ type: "err", text: data.message || "Save failed" });
      return;
    }
    setMessage({ type: "ok", text: "Saved." });
    setEditingId(null);
    router.refresh();
  }

  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? "—";
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Assign a region first, then a project in that region. Teams (DT + Driver/Rigger) use project assignment here after the team is created.
      </p>
      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Team</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Region</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Project</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((row) => (
              <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium text-zinc-900">{row.name}</td>
                {editingId === row.id ? (
                  <>
                    <td className="px-4 py-3">
                      <select
                        value={regionId}
                        onChange={(e) => {
                          setRegionId(e.target.value);
                          setProjectId("");
                        }}
                        className="w-full max-w-[200px] rounded border border-zinc-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">— None —</option>
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        disabled={!regionId}
                        className="w-full max-w-[220px] rounded border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="">— None —</option>
                        {projectsForRegion.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => save(row.id)}
                          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit} className="rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700">
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-zinc-700">{regionName(row.region_id)}</td>
                    <td className="px-4 py-3 text-zinc-700">{projectName(row.project_id)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
