"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Region = { id: string; name: string };
type Project = { id: string; name: string };
type Employee = { id: string; full_name: string; email: string };

export function AssignProjectRegionPmForm({
  regions,
  projects,
  pmEmployees,
}: {
  regions: Region[];
  projects: Project[];
  pmEmployees: Employee[];
}) {
  const router = useRouter();
  const [regionId, setRegionId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedEmployee = pmEmployees.find((e) => e.id === employeeId);
  const pmEmail = selectedEmployee?.email ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!regionId || !projectId || !employeeId || !pmEmail) {
      setError("Select region, project, and PM employee.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/project-region-pm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id: regionId, project_id: projectId, pm_email: pmEmail }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to assign");
      return;
    }
    router.refresh();
    setEmployeeId("");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Region</label>
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">— Select —</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">— Select —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">PM (Employee)</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">— Select PM —</option>
          {pmEmployees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.email})</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
        {saving ? "Saving…" : "Assign"}
      </button>
    </form>
  );
}
