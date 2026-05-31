"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ACTION_CATEGORY_LABELS,
  ACTION_CATEGORY_STYLES,
  PORTAL_STYLES,
  actionBadgeClass,
  formatActionLabel,
} from "@/components/audit/audit-ui";

type AuditLog = {
  id: string;
  timestamp: string;
  actor_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  portal: string | null;
  route_path: string | null;
  http_method: string | null;
  action_category: string | null;
  meta: Record<string, unknown> | null;
  old_value_json: Record<string, unknown> | null;
  new_value_json: Record<string, unknown> | null;
};

type Stats = {
  last24h: number;
  admin24h: number;
  employee24h: number;
  fileActions24h: number;
  byCategory: Record<string, number>;
};

const ENTITY_OPTIONS = [
  "",
  "asset",
  "employee",
  "employee_file",
  "user",
  "vehicle",
  "sim_card",
  "approval",
  "leave",
  "task",
  "region",
  "project",
  "team",
  "export",
  "import",
  "auth",
  "api",
];

const CATEGORY_OPTIONS = ["", "file", "data", "auth", "assignment", "approval", "export", "import", "api", "system"];

export function AuditLogExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const portal = searchParams.get("portal") ?? "";
  const action_category = searchParams.get("action_category") ?? "";
  const entity_type = searchParams.get("entity_type") ?? "";
  const actor = searchParams.get("actor") ?? "";
  const q = searchParams.get("q") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      router.push(`/audit?${next.toString()}`);
    },
    [router, searchParams]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const pageNum = parseInt(searchParams.get("page") ?? "1", 10) || 1;
    const qs = new URLSearchParams();
    qs.set("page", String(pageNum));
    qs.set("limit", "50");
    if (portal) qs.set("portal", portal);
    if (action_category) qs.set("action_category", action_category);
    if (entity_type) qs.set("entity_type", entity_type);
    if (actor) qs.set("actor", actor);
    if (q) qs.set("q", q);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/audit/logs?${qs}`),
        fetch("/api/audit/stats"),
      ]);
      const logsJson = await logsRes.json();
      const statsJson = await statsRes.json();
      if (logsRes.ok) {
        setLogs(logsJson.logs ?? []);
        setTotal(logsJson.total ?? 0);
        setPage(logsJson.page ?? 1);
        setTotalPages(logsJson.totalPages ?? 1);
      }
      if (statsRes.ok) setStats(statsJson);
    } finally {
      setLoading(false);
    }
  }, [searchParams, portal, action_category, entity_type, actor, q, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const headers = [
      "timestamp",
      "portal",
      "actor_email",
      "action_category",
      "action_type",
      "entity_type",
      "entity_id",
      "http_method",
      "route_path",
      "description",
    ];
    const rows = logs.map((l) =>
      [
        l.timestamp,
        l.portal ?? "",
        l.actor_email ?? "",
        l.action_category ?? "",
        l.action_type,
        l.entity_type,
        l.entity_id ?? "",
        l.http_method ?? "",
        l.route_path ?? "",
        l.description ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fts_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Last 24 hours" value={stats.last24h} sub="All portal activity" accent="from-indigo-500 to-violet-600" />
          <StatCard label="Admin portal" value={stats.admin24h} sub="Last 24h" accent="from-zinc-700 to-zinc-900" />
          <StatCard label="Employee portal" value={stats.employee24h} sub="Last 24h" accent="from-emerald-600 to-teal-700" />
          <StatCard label="File actions" value={stats.fileActions24h} sub="Uploads & downloads" accent="from-sky-500 to-blue-600" />
        </div>
      ) : null}

      {/* Filters */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm ring-1 ring-zinc-950/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
            <p className="text-xs text-zinc-500">Track uploads, downloads, updates, and all API activity across both portals.</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!logs.length}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Export page (CSV)
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Portal" value={portal} onChange={(v) => setFilter("portal", v)}>
            <option value="">All portals</option>
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
          </FilterSelect>
          <FilterSelect label="Category" value={action_category} onChange={(v) => setFilter("action_category", v)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.filter(Boolean).map((c) => (
              <option key={c} value={c}>
                {ACTION_CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Entity type" value={entity_type} onChange={(v) => setFilter("entity_type", v)}>
            <option value="">All entities</option>
            {ENTITY_OPTIONS.filter(Boolean).map((e) => (
              <option key={e} value={e}>
                {e.replace(/_/g, " ")}
              </option>
            ))}
          </FilterSelect>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Search</label>
            <input
              type="search"
              defaultValue={q}
              placeholder="Description, route, email…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilter("q", (e.target as HTMLInputElement).value);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Actor email</label>
            <input
              type="text"
              defaultValue={actor}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilter("actor", (e.target as HTMLInputElement).value);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFilter("from", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setFilter("to", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => router.push("/audit")}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-950/5">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{total.toLocaleString()}</span> events
            {loading ? " · Loading…" : ""}
          </p>
          <Pagination page={page} totalPages={totalPages} onPage={(p) => setFilter("page", String(p))} />
        </div>

        {loading && !logs.length ? (
          <div className="flex justify-center py-16 text-sm text-zinc-500">Loading activity…</div>
        ) : !logs.length ? (
          <div className="py-16 text-center text-sm text-zinc-500">No audit events match your filters.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-4 transition-colors hover:bg-zinc-50/60">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-700">
                    {(log.actor_email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {log.portal ? (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${PORTAL_STYLES[log.portal] ?? "bg-zinc-200"}`}>
                          {log.portal}
                        </span>
                      ) : null}
                      {log.action_category ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${ACTION_CATEGORY_STYLES[log.action_category] ?? ACTION_CATEGORY_STYLES.api}`}
                        >
                          {ACTION_CATEGORY_LABELS[log.action_category] ?? log.action_category}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${actionBadgeClass(log.action_type)}`}>
                        {formatActionLabel(log.action_type)}
                      </span>
                      {log.http_method ? (
                        <span className="font-mono text-[10px] text-zinc-500">{log.http_method}</span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-zinc-900">{log.description ?? "—"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>
                        <span className="font-medium text-zinc-700">{log.actor_email ?? "System"}</span>
                      </span>
                      <span>{log.entity_type.replace(/_/g, " ")}</span>
                      {log.entity_id ? <span className="font-mono">#{log.entity_id.slice(0, 8)}…</span> : null}
                      {log.route_path ? <span className="truncate font-mono text-zinc-400">{log.route_path}</span> : null}
                    </div>
                  </div>
                  <time dateTime={log.timestamp} className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </time>
                </div>
                {(log.meta || log.old_value_json || log.new_value_json) && (
                  <div className="mt-3 pl-12">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {expandedId === log.id ? "Hide details" : "View details"}
                    </button>
                    {expandedId === log.id ? (
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-100">
                        {JSON.stringify(
                          { meta: log.meta, old: log.old_value_json, new: log.new_value_json },
                          null,
                          2
                        )}
                      </pre>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
          <Pagination page={page} totalPages={totalPages} onPage={(p) => setFilter("page", String(p))} />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-gradient-to-br ${accent} p-5 text-white shadow-md`}>
      <p className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-white/70">{sub}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return <span className="text-xs text-zinc-500">Page 1</span>;
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
      >
        Prev
      </button>
      <span className="text-xs text-zinc-600">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
