"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OPERATIONAL_EXPORTS, SCOPE_EXPORTS } from "@/lib/exports/catalog";

type Region = { id: string; name: string };
type Project = { id: string; name: string; region_id: string };

export function ExportsCenter({
  regions,
  projects,
}: {
  regions: Region[];
  projects: Project[];
}) {
  const [regionId, setRegionId] = useState("");
  const [projectId, setProjectId] = useState("");

  const projectOptions = useMemo(() => {
    const list = regionId ? projects.filter((p) => p.region_id === regionId) : projects;
    const regionName = new Map(regions.map((r) => [r.id, r.name]));
    return [...list].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
      ...p,
      label: regionId ? p.name : `${p.name} (${regionName.get(p.region_id) ?? "—"})`,
    }));
  }, [projects, regionId, regions]);

  function hrefFor(dataset: string): string {
    const q = new URLSearchParams({ dataset });
    if (regionId) q.set("region_id", regionId);
    if (projectId) q.set("project_id", projectId);
    return `/api/exports?${q.toString()}`;
  }

  const scopeLabel = [
    regionId ? regions.find((r) => r.id === regionId)?.name ?? "Region" : "All regions",
    projectId ? projects.find((p) => p.id === projectId)?.name ?? "Project" : "All projects",
  ].join(" · ");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-cyan-50 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Exports Center</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Download Excel-compatible CSV files. Choose a region, a project, or both — every download uses that scope.
          Leave both on “All” for the full company file.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Scope</h2>
        <p className="mt-1 text-sm text-zinc-600">Current filter: {scopeLabel}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Region</span>
            <select
              value={regionId}
              onChange={(e) => {
                const next = e.target.value;
                setRegionId(next);
                const p = projects.find((x) => x.id === projectId);
                if (p && next && p.region_id !== next) setProjectId("");
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All regions</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All projects</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={hrefFor("all")}
            className="rounded bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800"
          >
            Download all CSVs (ZIP)
          </a>
          <button
            type="button"
            onClick={() => {
              setRegionId("");
              setProjectId("");
            }}
            className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Clear filters
          </button>
        </div>
      </section>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Region & project summaries</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Count rollups. Region-wise, project-wise, or region + project together.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {SCOPE_EXPORTS.map((item) => (
            <ExportCard key={item.key} item={item} href={hrefFor(item.key)} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Operational datasets</h2>
        <p className="mt-1 text-sm text-zinc-600">Same files as before, limited to the scope above when a filter is set.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {OPERATIONAL_EXPORTS.map((item) => (
            <ExportCard key={item.key} item={item} href={hrefFor(item.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportCard({ item, href }: { item: { key: string; label: string; desc: string }; href: string }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">{item.label}</h3>
      <p className="mt-1 text-sm text-zinc-600">{item.desc}</p>
      <div className="mt-4 flex items-center gap-2">
        <a href={href} className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Download CSV
        </a>
        <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-zinc-800">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
