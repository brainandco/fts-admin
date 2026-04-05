"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";

export type FtsEmployeeTableRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  region_name: string;
  has_portal_account: string;
};

export type FtsAdminOnlyTableRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  super_access: string;
};

function StatCard({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number;
  tone?: "zinc" | "emerald" | "amber" | "teal" | "violet";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "teal"
          ? "border-teal-200 bg-teal-50 text-teal-900"
          : tone === "violet"
            ? "border-violet-200 bg-violet-50 text-violet-900"
            : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const employeeColumns = [
  { key: "full_name" as keyof FtsEmployeeTableRow, label: "Name" },
  { key: "email" as keyof FtsEmployeeTableRow, label: "Email" },
  { key: "status" as keyof FtsEmployeeTableRow, label: "Status" },
  { key: "region_name" as keyof FtsEmployeeTableRow, label: "Region" },
  { key: "has_portal_account" as keyof FtsEmployeeTableRow, label: "Admin portal account" },
];

const adminColumns = [
  { key: "full_name" as keyof FtsAdminOnlyTableRow, label: "Name" },
  { key: "email" as keyof FtsAdminOnlyTableRow, label: "Email" },
  { key: "status" as keyof FtsAdminOnlyTableRow, label: "Status" },
  { key: "super_access" as keyof FtsAdminOnlyTableRow, label: "Super access" },
];

export function FtsPeopleDirectory({
  employeeRows,
  adminRows,
  isSuper,
  adminPortalOnlyCount,
  stats,
}: {
  employeeRows: FtsEmployeeTableRow[];
  adminRows: FtsAdminOnlyTableRow[];
  isSuper: boolean;
  /** When not super, show this count instead of the admin table. */
  adminPortalOnlyCount: number;
  stats: {
    totalFtsPeople: number;
    rosterCount: number;
    activeAdminPortalOnly: number;
  };
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-white to-zinc-50 p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Users & employees</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Everyone on the FTS employee roster plus admin portal accounts that are not tied to a roster email. Total
            avoids double-counting when someone has both a roster row and a login.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/employees" className="font-medium text-indigo-600 hover:text-indigo-800">
              Employee management →
            </Link>
            {isSuper ? (
              <Link href="/users" className="font-medium text-indigo-600 hover:text-indigo-800">
                Admin users →
              </Link>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total FTS people" value={stats.totalFtsPeople} tone="teal" />
          <StatCard label="On employee roster" value={stats.rosterCount} tone="emerald" />
          <StatCard label="Admin portal only (active)" value={stats.activeAdminPortalOnly} tone="violet" />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">FTS employees</h2>
            <p className="mt-1 text-sm text-zinc-600">
              People recorded on the employee roster. “Admin portal account” means a matching email exists in{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs">users_profile</code>.
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {employeeRows.length} on roster
          </span>
        </div>
        <DataTable<FtsEmployeeTableRow & Record<string, unknown>>
          columns={employeeColumns}
          data={employeeRows}
          keyField="id"
          hrefPrefix="/employees/"
          searchPlaceholder="Search employees…"
          filterKeys={["status", "region_name"]}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-medium text-zinc-900">Admin portal users (not on roster)</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Active accounts whose email is not on the employee roster—these are admin-only portal users (not counted as a
            separate “employee” row above).
          </p>
        </div>
        {isSuper ? (
          <DataTable<FtsAdminOnlyTableRow & Record<string, unknown>>
            columns={adminColumns}
            data={adminRows}
            keyField="id"
            searchPlaceholder="Search admin users…"
            filterKeys={["status"]}
          />
        ) : (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">{adminPortalOnlyCount}</span> active admin portal account
            {adminPortalOnlyCount === 1 ? "" : "s"} not on the employee roster. The full list is visible to Super
            Users under <Link className="font-medium text-indigo-600 hover:text-indigo-800" href="/users">Users</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
