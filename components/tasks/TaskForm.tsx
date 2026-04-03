"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Region = { id: string; name: string };
type User = { id: string; full_name: string | null; email: string };
type Project = { id: string; name: string; region_id: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  region_id: string;
  project_id: string | null;
  assigned_to_pm_id: string | null;
  assigned_to_user_id: string | null;
} | null;

export function TaskForm({
  existing,
  regions,
  pms,
  projects,
  currentUserId,
}: {
  existing: Task;
  regions: Region[];
  pms: User[];
  projects: Project[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [status, setStatus] = useState(existing?.status ?? "Draft");
  const [priority, setPriority] = useState(String(existing?.priority ?? 0));
  const [dueDate, setDueDate] = useState(existing?.due_date?.slice(0, 10) ?? "");
  const [regionId, setRegionId] = useState(existing?.region_id ?? regions[0]?.id ?? "");
  const [projectId, setProjectId] = useState(existing?.project_id ?? "");
  const [assignedToPmId, setAssignedToPmId] = useState(existing?.assigned_to_pm_id ?? "");
  const [assignedToUserId, setAssignedToUserId] = useState(existing?.assigned_to_user_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const regionProjects = projects.filter((p) => p.region_id === regionId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url = existing ? `/api/tasks/${existing.id}` : "/api/tasks";
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        status,
        priority: parseInt(priority, 10) || 0,
        due_date: dueDate || null,
        region_id: regionId,
        project_id: projectId || null,
        assigned_to_pm_id: assignedToPmId || null,
        assigned_to_user_id: assignedToUserId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Failed to save");
      return;
    }
    router.push(existing ? `/tasks/${existing.id}` : "/tasks");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
            <option value="Draft">Draft</option>
            <option value="Assigned_to_PM">Assigned to PM</option>
            <option value="Assigned_to_User">Assigned to User</option>
            <option value="In_Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
            <option value="Completed">Completed</option>
            <option value="Verified">Verified</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">Priority</label>
          <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Due date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
        <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setProjectId(""); }} required className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Project</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {regionProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Assigned to PM</label>
        <select value={assignedToPmId} onChange={(e) => setAssignedToPmId(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {pms.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">Assigned to user</label>
        <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)} className="w-full rounded border border-zinc-300 px-3 py-2 text-sm">
          <option value="">—</option>
          {pms.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
          {saving ? "Saving…" : existing ? "Update" : "Create"}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
      </div>
    </form>
  );
}
