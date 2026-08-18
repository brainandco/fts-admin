"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DailyOdoSummary } from "@/lib/odometer/daily-summary";
import { splitPlateParts } from "@/lib/odometer/plate-parts";

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function km(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function PhotoLinks({ urls }: { urls: string }) {
  const list = urls
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return <span className="text-zinc-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sky-700 hover:underline"
        >
          Photo {i + 1}
        </a>
      ))}
    </span>
  );
}

export function OdometerTrackingTable({ rows }: { rows: DailyOdoSummary[] }) {
  const dates = useMemo(() => [...new Set(rows.map((r) => r.reading_date))].sort().reverse(), [rows]);
  const regions = useMemo(
    () => [...new Set(rows.map((r) => r.region).filter(Boolean))].sort(),
    [rows]
  );
  const [date, setDate] = useState(dates[0] ?? "");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (date && r.reading_date !== date) return false;
      if (region && r.region !== region) return false;
      if (!query) return true;
      return [r.driver, r.plate, r.vehicleLabel, r.team, r.employee_id].some((v) =>
        v.toLowerCase().includes(query)
      );
    });
  }, [rows, date, region, q]);

  const complete = filtered.filter((r) => r.status === "Complete");
  const todayKmSum = complete.reduce((s, r) => s + (r.todayKm ?? 0), 0);
  const vsPrevSum = filtered.reduce((s, r) => s + (r.vsPreviousKm ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Rows shown</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{filtered.length}</p>
          <p className="text-xs text-zinc-500">{complete.length} complete (start + end)</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Today km (sum)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-950">{todayKmSum.toLocaleString()} km</p>
          <p className="text-xs text-emerald-800">End − start for complete duties</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800">vs previous shift (sum)</p>
          <p className="mt-1 text-2xl font-semibold text-sky-950">{vsPrevSum.toLocaleString()} km</p>
          <p className="text-xs text-sky-800">Shift total − previous shift total</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Date</span>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All dates</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Region</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Driver, plate, vehicle…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Plate</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Shift km</th>
              <th className="px-3 py-2">vs previous</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  No odometer readings for this filter.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const key = `${r.vehicle_id}|${r.reading_date}|${r.morningAt ?? r.eveningAt ?? ""}`;
                const open = openKey === key;
                return (
                  <FragmentRow
                    key={key}
                    row={r}
                    open={open}
                    onToggle={() => setOpenKey(open ? null : key)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  row: r,
  open,
  onToggle,
}: {
  row: DailyOdoSummary;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-zinc-100 hover:bg-zinc-50/80">
        <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">{r.reading_date}</td>
        <td className="px-3 py-2">
          <div className="font-medium text-zinc-900">{r.driver || "—"}</div>
          <div className="text-xs text-zinc-500">
            {[r.region, r.team].filter(Boolean).join(" · ") || "—"}
          </div>
        </td>
        <td className="px-3 py-2">
          <Link href={`/vehicles/${r.vehicle_id}`} className="font-medium text-sky-800 hover:underline">
            {(() => {
              const p = splitPlateParts(r.plate);
              return p.letters && p.digits ? `${p.letters} · ${p.digits}` : r.plate || "—";
            })()}
          </Link>
          <div className="text-xs text-zinc-500">{r.vehicleLabel || "—"}</div>
        </td>
        <td className="px-3 py-2">
          <div className="font-medium">{km(r.morningKm)}</div>
          <div className="text-xs text-zinc-500">{fmtTs(r.morningAt)}</div>
        </td>
        <td className="px-3 py-2">
          <div className="font-medium">{km(r.eveningKm)}</div>
          <div className="text-xs text-zinc-500">{fmtTs(r.eveningAt)}</div>
        </td>
        <td className="px-3 py-2 font-semibold text-emerald-800">{km(r.todayKm)}</td>
        <td className="px-3 py-2">
          <div className="font-semibold text-sky-900">{km(r.vsPreviousKm)}</div>
          <div className="text-xs text-zinc-500">
                {r.previousDate ? `${r.previousDate} · ${km(r.previousTotalKm)}` : "no previous shift"}
          </div>
        </td>
        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              r.status === "Complete"
                ? "bg-emerald-100 text-emerald-800"
                : r.status === "On duty"
                  ? "bg-sky-100 text-sky-800"
                  : "bg-amber-100 text-amber-900"
            }`}
          >
            {r.status}
          </span>
        </td>
        <td className="px-3 py-2">
          <button type="button" onClick={onToggle} className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
            {open ? "Hide" : "Details"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-zinc-100 bg-zinc-50/70">
          <td colSpan={9} className="px-4 py-3 text-xs text-zinc-700">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <p>
                <span className="font-medium">Shift total:</span> {km(r.dayTotalKm)} km
              </p>
              <p>
                <span className="font-medium">Start location:</span>{" "}
                {r.morningGps || "—"}{" "}
                {r.morningMapsUrl ? (
                  <a href={r.morningMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                    Map
                  </a>
                ) : null}
              </p>
              <p>
                <span className="font-medium">End location:</span>{" "}
                {r.eveningGps || "—"}{" "}
                {r.eveningMapsUrl ? (
                  <a href={r.eveningMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline">
                    Map
                  </a>
                ) : null}
              </p>
              <div>
                <p className="font-medium">Start plate</p>
                <PhotoLinks urls={r.morningPlatePhoto} />
              </div>
              <div>
                <p className="font-medium">Start odometer</p>
                <PhotoLinks urls={r.morningOdoPhotos} />
              </div>
              <div>
                <p className="font-medium">End plate</p>
                <PhotoLinks urls={r.eveningPlatePhoto} />
              </div>
              <div>
                <p className="font-medium">End odometer</p>
                <PhotoLinks urls={r.eveningOdoPhotos} />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
