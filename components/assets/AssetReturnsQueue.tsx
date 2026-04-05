"use client";

import { useEffect, useState } from "react";
import { ClearMaintenanceButton } from "@/components/assets/ClearMaintenanceButton";

type Row = {
  id: string;
  asset_id: string;
  from_employee_id: string;
  employee_comment: string;
  return_image_urls?: string[] | null;
  created_at: string;
  status?: string;
  pm_decision?: string | null;
  pm_comment?: string | null;
  processed_at?: string | null;
  asset: {
    id: string;
    name: string;
    model: string | null;
    serial: string | null;
    imei_1: string | null;
    imei_2: string | null;
    category: string;
    status?: string;
  } | null;
  from_employee_name: string | null;
};

export function AssetReturnsQueue({ canClearMaintenance = false }: { canClearMaintenance?: boolean }) {
  const [pending, setPending] = useState<Row[]>([]);
  const [maintenance, setMaintenance] = useState<Row[]>([]);
  const [damaged, setDamaged] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/assets/return-requests");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Failed to load");
        setPending([]);
        setMaintenance([]);
        setDamaged([]);
        return;
      }
      setPending(data.pending ?? []);
      setMaintenance(data.under_maintenance ?? []);
      setDamaged(data.damaged ?? []);
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-sm text-zinc-500">Loading return queue…</p>;
  if (error && pending.length === 0 && maintenance.length === 0 && damaged.length === 0) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900">Pending returns</h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No pending asset returns.</p>
        ) : (
          pending.map((row) => (
            <div key={row.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-900">{row.asset?.name ?? "Asset"}</h3>
                  <p className="text-sm text-zinc-500">
                    {row.asset?.category ?? "—"}
                    {row.asset?.model ? ` · Model: ${row.asset.model}` : ""}
                    {row.asset?.serial ? ` · Serial: ${row.asset.serial}` : ""}
                    {row.asset?.imei_1 ? ` · IMEI 1: ${row.asset.imei_1}` : ""}
                    {row.asset?.imei_2 ? ` · IMEI 2: ${row.asset.imei_2}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    <span className="font-medium text-zinc-800">Returned by:</span> {row.from_employee_name ?? row.from_employee_id}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Employee comment:</span> {row.employee_comment}
                  </p>
                  {Array.isArray(row.return_image_urls) && row.return_image_urls.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.return_image_urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 overflow-hidden rounded border border-zinc-200 bg-zinc-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-400">{new Date(row.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                PM reviews and sets the final status in the PM return queue.
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900">Under maintenance (from returns)</h2>
        {maintenance.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No assets currently under maintenance via return workflow.</p>
        ) : (
          maintenance.map((row) => (
            <div key={row.id} className="rounded-xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-900">{row.asset?.name ?? "Asset"}</h3>
                  <p className="text-sm text-zinc-500">
                    {row.asset?.category ?? "—"}
                    {row.asset?.model ? ` · Model: ${row.asset.model}` : ""}
                    {row.asset?.serial ? ` · Serial: ${row.asset.serial}` : ""}
                    {row.asset?.imei_1 ? ` · IMEI 1: ${row.asset.imei_1}` : ""}
                    {row.asset?.imei_2 ? ` · IMEI 2: ${row.asset.imei_2}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    <span className="font-medium text-zinc-800">Returned by:</span> {row.from_employee_name ?? row.from_employee_id}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Employee comment:</span> {row.employee_comment}
                  </p>
                  {Array.isArray(row.return_image_urls) && row.return_image_urls.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.return_image_urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 overflow-hidden rounded border border-zinc-200 bg-zinc-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {row.pm_comment ? (
                    <p className="mt-2 text-sm text-zinc-700">
                      <span className="font-medium text-zinc-900">PM comment:</span> {row.pm_comment}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-400">
                    Processed: {row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                    Under_Maintenance
                  </span>
                  <ClearMaintenanceButton
                    assetId={row.asset_id}
                    canClear={canClearMaintenance}
                    onCleared={load}
                    className="text-right"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900">Damaged (from returns)</h2>
        {damaged.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">No assets currently marked damaged via return workflow.</p>
        ) : (
          damaged.map((row) => (
            <div key={row.id} className="rounded-xl border border-red-200 bg-red-50/30 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-900">{row.asset?.name ?? "Asset"}</h3>
                  <p className="text-sm text-zinc-500">
                    {row.asset?.category ?? "—"}
                    {row.asset?.model ? ` · Model: ${row.asset.model}` : ""}
                    {row.asset?.serial ? ` · Serial: ${row.asset.serial}` : ""}
                    {row.asset?.imei_1 ? ` · IMEI 1: ${row.asset.imei_1}` : ""}
                    {row.asset?.imei_2 ? ` · IMEI 2: ${row.asset.imei_2}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    <span className="font-medium text-zinc-800">Returned by:</span> {row.from_employee_name ?? row.from_employee_id}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium text-zinc-900">Employee comment:</span> {row.employee_comment}
                  </p>
                  {Array.isArray(row.return_image_urls) && row.return_image_urls.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.return_image_urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-20 w-20 overflow-hidden rounded border border-zinc-200 bg-zinc-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {row.pm_comment ? (
                    <p className="mt-2 text-sm text-zinc-700">
                      <span className="font-medium text-zinc-900">PM comment:</span> {row.pm_comment}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-400">
                    Processed: {row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}
                  </p>
                </div>
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Damaged</span>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
