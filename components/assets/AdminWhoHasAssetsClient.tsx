"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AssetLine = {
  id: string;
  name: string | null;
  model: string | null;
  serial: string | null;
  category: string | null;
  status: string | null;
};

export type AdminEmployeeWithAssets = {
  id: string;
  full_name: string;
  email: string | null;
  roles: string[];
  assets: AssetLine[];
  regionId: string | null;
  regionLabel: string;
};

function statusStyles(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "assigned") return "border-l-emerald-500 bg-emerald-50/40";
  if (s === "under_maintenance") return "border-l-amber-500 bg-amber-50/40";
  if (s === "damaged") return "border-l-rose-500 bg-rose-50/40";
  if (s === "with_qc") return "border-l-violet-500 bg-violet-50/40";
  return "border-l-zinc-300 bg-zinc-50/60";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function modelDisplay(model: string | null | undefined): string {
  const m = (model ?? "").trim();
  return m.length > 0 ? m : "N/A";
}

function haystack(emp: AdminEmployeeWithAssets, a: AssetLine): string {
  return [
    emp.full_name,
    emp.email ?? "",
    emp.regionLabel,
    ...emp.roles,
    a.name,
    a.model,
    a.serial,
    a.category,
    a.status,
  ]
    .join(" ")
    .toLowerCase();
}

export function AdminWhoHasAssetsClient({
  employees,
  withoutCount,
  regionOptions,
}: {
  employees: AdminEmployeeWithAssets[];
  withoutCount: number;
  regionOptions: { id: string; label: string }[];
}) {
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = employees;
    if (regionFilter === "none") {
      list = list.filter((e) => e.regionId === null);
    } else if (regionFilter !== "all") {
      list = list.filter((e) => e.regionId === regionFilter);
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((emp) => {
      if (
        emp.full_name.toLowerCase().includes(needle) ||
        (emp.email ?? "").toLowerCase().includes(needle) ||
        emp.regionLabel.toLowerCase().includes(needle) ||
        emp.roles.some((r) => r.toLowerCase().includes(needle))
      ) {
        return true;
      }
      return emp.assets.some((a) => haystack(emp, a).includes(needle));
    });
  }, [employees, q, regionFilter]);

  const totalTools = useMemo(() => employees.reduce((n, e) => n + e.assets.length, 0), [employees]);

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-10 text-center shadow-inner">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl">📦</div>
        <p className="text-base font-semibold text-zinc-800">No assigned tools company-wide</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
          When assets are assigned to active employees, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Overview</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{employees.length}</p>
            <p className="text-sm text-white/85">active employees holding tools</p>
            <p className="mt-2 text-sm text-white/75">
              <span className="font-semibold text-white">{totalTools}</span> assignments company-wide
              {withoutCount > 0 ? (
                <span className="mt-1 block text-xs text-white/70">
                  {withoutCount} other active employee{withoutCount === 1 ? "" : "s"} with no tools
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex w-full max-w-xl shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-[11rem]">
              <label htmlFor="who-has-region" className="mb-1 block text-xs font-medium text-white/80">
                Region
              </label>
              <select
                id="who-has-region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full rounded-xl border border-white/25 bg-white/15 py-2.5 pl-3 pr-8 text-sm text-white backdrop-blur-sm focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 [&>option]:text-zinc-900"
              >
                <option value="all">All regions</option>
                <option value="none">No region</option>
                {regionOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="who-has-search" className="sr-only">
                Search employees and tools
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60" aria-hidden>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  id="who-has-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, email, region, model…"
                  className="w-full rounded-xl border border-white/25 bg-white/15 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/50 backdrop-blur-sm focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              {q.trim() || regionFilter !== "all" ? (
                <p className="mt-2 text-xs text-white/80">
                  Showing {filtered.length} of {employees.length} employees
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-800">No matches</p>
          <p className="mt-1 text-sm text-zinc-600">Try a different search, region, or clear filters.</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setRegionFilter("all");
            }}
            className="mt-4 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-1 xl:grid-cols-2">
          {filtered.map((emp) => (
            <li
              key={emp.id}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-100 transition hover:shadow-md hover:ring-indigo-100"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-90" />
              <div className="flex gap-4 p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md"
                  aria-hidden
                >
                  {initials(emp.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{emp.full_name}</h2>
                      {emp.email ? <p className="text-xs text-zinc-500">{emp.email}</p> : null}
                      <p className="mt-1 text-xs font-medium text-indigo-700">{emp.regionLabel}</p>
                      {emp.roles.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {emp.roles.map((r) => (
                            <span
                              key={r}
                              className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200/80">
                        {emp.assets.length} tool{emp.assets.length === 1 ? "" : "s"}
                      </span>
                      <Link
                        href={`/employees/${emp.id}`}
                        className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:underline"
                      >
                        Employee record
                      </Link>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {emp.assets.map((a) => (
                      <li
                        key={a.id}
                        className={`rounded-xl border border-zinc-100 border-l-4 py-2.5 pl-3 pr-3 text-sm ${statusStyles(a.status)}`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                          <span className="font-semibold text-zinc-900">{a.name?.trim() || a.category || "Asset"}</span>
                          {a.status ? (
                            <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              {(a.status ?? "").replace(/_/g, " ")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">
                          <span className="font-medium text-zinc-800">Model:</span> {modelDisplay(a.model)}
                          {a.category ? (
                            <>
                              {" "}
                              · <span className="text-zinc-500">{a.category}</span>
                            </>
                          ) : null}
                          {a.serial ? (
                            <span className="ml-1 font-mono text-[11px] text-zinc-400">· {a.serial}</span>
                          ) : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
