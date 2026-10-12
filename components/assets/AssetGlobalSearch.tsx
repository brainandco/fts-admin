"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type AssetSearchItem = {
  id: string;
  asset_id: string | null;
  name: string;
  category: string | null;
  model: string | null;
  serial: string | null;
  imei_1: string | null;
  imei_2: string | null;
  status: string;
  assigned_name: string;
  software_connectivity?: string | null;
};

function statusClass(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "available") return "bg-emerald-100 text-emerald-800";
  if (s === "assigned") return "bg-amber-100 text-amber-800";
  if (s === "pending_return") return "bg-violet-100 text-violet-800";
  if (s === "under_maintenance") return "bg-orange-100 text-orange-800";
  if (s === "damaged") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-700";
}

/** Server-backed search — does not require loading the full asset list into the page. */
export function AssetGlobalSearch(_props?: { assets?: AssetSearchItem[] }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<AssetSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(() => {
      void fetch(`/api/assets/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          setResults(Array.isArray(data.assets) ? data.assets : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const showDropdown = focused && query.trim().length > 0;

  return (
    <div className="relative">
      <label htmlFor="asset-global-search" className="sr-only">
        Search all assets
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          id="asset-global-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Search assets by name, ID, serial, IMEI…"
          className="w-full rounded-lg border border-zinc-300 py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          autoComplete="off"
        />
      </div>
      {showDropdown ? (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-3 text-sm text-zinc-500">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-500">No matches</p>
          ) : (
            <ul className="divide-y divide-zinc-100 py-1">
              {results.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/assets/${a.id}`}
                    className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{a.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {[a.asset_id, a.category, a.serial, a.assigned_name !== "—" ? a.assigned_name : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(a.status)}`}>
                      {a.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
