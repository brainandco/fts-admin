"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

function haystack(item: AssetSearchItem): string {
  return [
    item.asset_id,
    item.name,
    item.category,
    item.model,
    item.serial,
    item.imei_1,
    item.imei_2,
    item.status,
    item.assigned_name,
    item.software_connectivity,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function statusClass(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "available") return "bg-emerald-100 text-emerald-800";
  if (s === "assigned") return "bg-amber-100 text-amber-800";
  if (s === "pending_return") return "bg-violet-100 text-violet-800";
  if (s === "under_maintenance") return "bg-orange-100 text-orange-800";
  if (s === "damaged") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-700";
}

export function AssetGlobalSearch({ assets }: { assets: AssetSearchItem[] }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return assets.filter((a) => haystack(a).includes(q)).slice(0, 20);
  }, [assets, query]);

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
          placeholder="Search all assets — name, serial, asset ID, IMEI, category, assignee…"
          className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-10 pr-4 text-sm shadow-sm placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          autoComplete="off"
        />
      </div>

      {showDropdown ? (
        <div className="absolute z-30 mt-2 max-h-[min(24rem,70vh)] w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No assets match &ldquo;{query.trim()}&rdquo;</p>
          ) : (
            <ul>
              {results.map((item) => {
                const subtitle = [
                  item.asset_id,
                  item.category,
                  item.model,
                  item.serial ? `S/N ${item.serial}` : null,
                  item.imei_1 ? `IMEI ${item.imei_1}` : null,
                  item.assigned_name !== "—" ? `→ ${item.assigned_name}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={item.id}>
                    <Link
                      href={`/assets/${item.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-900">{item.name}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(item.status)}`}
                      >
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {results.length === 20 ? (
            <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">Showing first 20 matches — refine your search.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
