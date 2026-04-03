"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type UserListRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  is_super_user: boolean;
  created_at: string | null;
  roles_display: string;
};

function initials(email: string, fullName: string | null): string {
  const n = (fullName ?? "").trim();
  if (n.length >= 2) return (n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
  const e = email.trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_ACCESS: "bg-amber-50 text-amber-900 border-amber-200 ring-1 ring-amber-100",
    ACTIVE: "bg-emerald-50 text-emerald-900 border-emerald-200 ring-1 ring-emerald-100",
    DISABLED: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  const style = styles[status] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
  const label =
    status === "PENDING_ACCESS" ? "Pending" : status === "ACTIVE" ? "Active" : status === "DISABLED" ? "Disabled" : status;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "emerald" | "amber" | "teal";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/80 text-amber-900"
        : tone === "teal"
          ? "border-teal-200 bg-teal-50/80 text-teal-900"
          : "border-zinc-200 bg-zinc-50/80 text-zinc-800";

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function UsersList({ rows }: { rows: UserListRow[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "__all__" && r.status !== statusFilter) return false;
      if (!term) return true;
      const hay = `${r.email} ${r.full_name ?? ""} ${r.roles_display}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "ACTIVE").length;
    const pending = rows.filter((r) => r.status === "PENDING_ACCESS").length;
    const disabled = rows.filter((r) => r.status === "DISABLED").length;
    return { total, active, pending, disabled };
  }, [rows]);

  const statusOptions = useMemo(() => {
    const u = new Set(rows.map((r) => r.status));
    return Array.from(u).sort();
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-teal-50/30 to-zinc-50 shadow-sm ring-1 ring-zinc-100">
        <div className="flex flex-col gap-4 border-b border-zinc-100/80 px-6 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Users</h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
              Admin portal accounts only. People listed here can sign in to this dashboard. Workforce records live under{" "}
              <Link href="/employees" className="font-medium text-teal-800 underline decoration-teal-300/80 underline-offset-2 hover:text-teal-950">
                Employees
              </Link>
              — those emails are excluded here.
            </p>
          </div>
          <Link
            href="/users/invite"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/10 transition hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Add user
          </Link>
        </div>

        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.total} tone="teal" />
          <StatCard label="Active" value={stats.active} tone="emerald" />
          <StatCard label="Pending access" value={stats.pending} tone="amber" />
          <StatCard label="Disabled" value={stats.disabled} tone="zinc" />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              aria-label="Search users"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="user-status-filter" className="text-sm font-medium text-zinc-600">
              Status
            </label>
            <select
              id="user-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="__all__">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "PENDING_ACCESS" ? "Pending" : s === "ACTIVE" ? "Active" : s === "DISABLED" ? "Disabled" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-100">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/90">
                  <th className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    User
                  </th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Roles
                  </th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Added
                  </th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <p className="text-sm font-medium text-zinc-700">No users match your filters.</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {rows.length === 0
                          ? "Invite an admin user to get started."
                          : "Try adjusting search or status."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="group transition-colors hover:bg-teal-50/40">
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-xs font-bold text-teal-900 ring-2 ring-white shadow-sm"
                            aria-hidden
                          >
                            {initials(r.email, r.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-zinc-900">{r.full_name?.trim() || "—"}</p>
                            <p className="truncate text-xs text-zinc-500">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-4 align-middle">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.is_super_user && (
                            <span className="inline-flex rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-900 ring-1 ring-violet-200">
                              Super
                            </span>
                          )}
                          <span className="text-sm text-zinc-700">{r.roles_display}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 align-middle text-zinc-600">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <Link
                          href={`/users/${r.id}`}
                          className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-950"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Showing <span className="font-medium text-zinc-700">{filtered.length}</span> of{" "}
          <span className="font-medium text-zinc-700">{rows.length}</span> admin users
        </p>
      </div>
    </div>
  );
}
