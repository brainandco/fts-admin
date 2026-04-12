"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { employeeMayHaveFormalProjectOnRecord } from "@/lib/employees/employee-record-project-roles";

type TeamRef = { id: string; label: string };

type Row = {
  id: string;
  full_name: string;
  region_id: string | null;
  project_id: string | null;
  status: string;
  team_memberships: TeamRef[];
  role: string;
  /** `employee_roles.role` — use for project eligibility, not display `role`. */
  role_code: string;
};

function canAssignRegionProject(row: Row): boolean {
  return row.status === "ACTIVE" && row.team_memberships.length === 0;
}

type Region = { id: string; name: string };
type Project = { id: string; name: string; region_id: string };

type AssignmentFilter = "all" | "no_region" | "complete";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rowAttention(row: Row): "ok" | "no_region" {
  if (!row.region_id) return "no_region";
  return "ok";
}

function rowBlocked(row: Row): boolean {
  return !canAssignRegionProject(row);
}

function roleBadgeClass(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("project manager")) return "bg-violet-100 text-violet-800 ring-violet-200";
  if (r.includes("coordinator")) return "bg-sky-100 text-sky-800 ring-sky-200";
  if (r === "qa" || r.includes("qc")) return "bg-amber-100 text-amber-900 ring-amber-200";
  if (r.includes("self dt")) return "bg-indigo-100 text-indigo-800 ring-indigo-200";
  if (r.includes("driver") || r.includes("rigger")) return "bg-teal-100 text-teal-800 ring-teal-200";
  if (r.includes("dt")) return "bg-blue-100 text-blue-800 ring-blue-200";
  if (r.includes("pp")) return "bg-rose-100 text-rose-800 ring-rose-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

export function EmployeeRegionProjectAssignmentsClient({
  employees,
  regions,
  projects,
}: {
  employees: Row[];
  regions: Region[];
  projects: Project[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regionId, setRegionId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");

  const projectsSorted = useMemo(() => [...projects].sort((a, b) => a.name.localeCompare(b.name)), [projects]);

  const distinctRoles = useMemo(() => {
    const s = new Set<string>();
    for (const e of employees) {
      if (e.role) s.add(e.role);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((row) => {
      if (q && !row.full_name.toLowerCase().includes(q)) return false;
      if (roleFilter && row.role !== roleFilter) return false;
      const att = rowAttention(row);
      if (assignmentFilter === "no_region" && att !== "no_region") return false;
      if (assignmentFilter === "complete" && att !== "ok") return false;
      return true;
    });
  }, [employees, query, roleFilter, assignmentFilter]);

  const sortedRows = useMemo(() => {
    const order = { no_region: 0, ok: 1 };
    return [...filtered].sort((a, b) => {
      const ba = rowBlocked(a) ? 1 : 0;
      const bb = rowBlocked(b) ? 1 : 0;
      if (ba !== bb) return ba - bb;
      const da = rowAttention(a);
      const db = rowAttention(b);
      if (order[da] !== order[db]) return order[da] - order[db];
      return a.full_name.localeCompare(b.full_name);
    });
  }, [filtered]);

  const stats = useMemo(() => {
    let needRegion = 0;
    let withRegion = 0;
    for (const e of employees) {
      if (!e.region_id) needRegion++;
      else withRegion++;
    }
    return { total: employees.length, needRegion, withRegion };
  }, [employees]);

  function startEdit(row: Row) {
    if (!canAssignRegionProject(row)) {
      if (row.status !== "ACTIVE") {
        setMessage({
          type: "err",
          text: "Inactive employees cannot receive region or project changes. Reactivate them on their employee profile first.",
        });
      } else if (row.team_memberships.length > 0) {
        setMessage({
          type: "err",
          text: "This employee is on a team. Replace or remove them in Teams before changing region or project.",
        });
      }
      return;
    }
    setEditingId(row.id);
    setRegionId(row.region_id ?? "");
    setProjectId(row.project_id ?? "");
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setMessage(null);
  }

  async function save(employeeId: string, roleCode: string, row: Row) {
    if (!canAssignRegionProject(row)) {
      setMessage({ type: "err", text: "Cannot save: employee is inactive or on a team." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const mayProject = employeeMayHaveFormalProjectOnRecord(roleCode);
    const body: { region_id: string | null; project_id: string | null } = {
      region_id: regionId || null,
      project_id: mayProject ? (projectId || null) : null,
    };
    if (!mayProject && projectId) {
      setMessage({ type: "err", text: "Driver/Rigger and QC cannot have a formal project on their record." });
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/employees/${employeeId}/assignment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  const regionName = (id: string | null) => regions.find((r) => r.id === id)?.name ?? null;
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  const selectClass = inputClass;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Employees</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">No region</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">{stats.needRegion}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">Region assigned</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{stats.withRegion}</p>
        </div>
      </div>

      {message ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="emp-search" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Search
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              id="emp-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[160px]">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Role</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
            <option value="">All roles</option>
            {distinctRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid w-full gap-3 sm:w-auto sm:min-w-[200px]">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Assignment</label>
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as AssignmentFilter)}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="no_region">Missing region</option>
            <option value="complete">Has region</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-zinc-500">
        Showing <span className="font-medium text-zinc-800">{sortedRows.length}</span> of {employees.length} — need attention sorted first
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md shadow-zinc-900/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-slate-50/80">
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Employee</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Role</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Region</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-600">Project</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-zinc-500">No employees match your filters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("");
                        setAssignmentFilter("all");
                      }}
                      className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, i) => {
                  const att = rowAttention(row);
                  const isEditing = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${isEditing ? "bg-indigo-50/60" : i % 2 === 0 ? "bg-white" : "bg-zinc-50/40"} ${rowBlocked(row) ? "opacity-[0.92]" : ""} hover:bg-indigo-50/30`}
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white shadow-sm"
                            aria-hidden
                          >
                            {initials(row.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-900">{row.full_name || "—"}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {row.status !== "ACTIVE" ? (
                                <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
                                  Inactive
                                </span>
                              ) : null}
                              {row.team_memberships.length > 0 ? (
                                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
                                  On team
                                </span>
                              ) : null}
                              {att === "no_region" && !isEditing && canAssignRegionProject(row) ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
                                  Needs region
                                </span>
                              ) : null}
                            </div>
                            {row.team_memberships.length > 0 ? (
                              <p className="mt-1 max-w-xs text-[11px] leading-snug text-rose-800/90">
                                {row.status !== "ACTIVE"
                                  ? "Inactive and still on a team — replace them in Teams after reactivation if needed."
                                  : "On a team — open Teams to replace or remove this person before changing region or project."}{" "}
                                {row.team_memberships.map((tm, idx) => (
                                  <span key={tm.id}>
                                    {idx > 0 ? " · " : ""}
                                    <Link href={`/teams/${tm.id}`} className="font-medium underline hover:text-rose-950">
                                      {tm.label}
                                    </Link>
                                  </span>
                                ))}
                              </p>
                            ) : row.status !== "ACTIVE" ? (
                              <p className="mt-1 max-w-xs text-[11px] text-zinc-500">
                                Reactivate on the employee profile to assign region or project.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        {row.role ? (
                          <span className={`inline-flex max-w-[200px] truncate rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${roleBadgeClass(row.role)}`}>
                            {row.role}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      {isEditing ? (
                        <>
                          <td className="px-4 py-3 align-middle">
                            <select
                              value={regionId}
                              onChange={(e) => setRegionId(e.target.value)}
                              className={selectClass}
                            >
                              <option value="">— No region —</option>
                              {regions.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {employeeMayHaveFormalProjectOnRecord(row.role_code) ? (
                              <select
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className={selectClass}
                              >
                                <option value="">— No project —</option>
                                {projectsSorted.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-zinc-400">Region only (Driver/Rigger, QC)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => save(row.id, row.role_code, row)}
                                className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5 align-middle">
                            {regionName(row.region_id) ? (
                              <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-900">
                                {regionName(row.region_id)}
                              </span>
                            ) : (
                              <span className="inline-flex rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-2.5 py-1 text-xs font-medium text-amber-900">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            {employeeMayHaveFormalProjectOnRecord(row.role_code) ? (
                              projectName(row.project_id) ? (
                                <span className="inline-flex max-w-[220px] truncate rounded-lg border border-sky-100 bg-sky-50/90 px-2.5 py-1 text-xs font-medium text-sky-900">
                                  {projectName(row.project_id)}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                  No project
                                </span>
                              )
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right align-middle">
                            <button
                              type="button"
                              disabled={!canAssignRegionProject(row)}
                              title={
                                !canAssignRegionProject(row)
                                  ? row.status !== "ACTIVE"
                                    ? "Inactive employees cannot be edited here"
                                    : "Replace or remove from Teams first"
                                  : undefined
                              }
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
