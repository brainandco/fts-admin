"use client";

import { useEffect, useMemo, useState } from "react";

type Invoice = {
  id: string;
  employee_name: string | null;
  status: string;
  is_vat: boolean;
  invoice_number: string | null;
  seller_name: string | null;
  invoice_date: string | null;
  amount_without_vat: number;
  vat_amount: number;
  amount_with_vat: number;
  image_url: string | null;
  amount_mismatch: boolean;
  created_at: string;
  qr_payload: string | null;
};

function monthKey(row: Invoice) {
  if (row.invoice_date && /^\d{4}-\d{2}/.test(row.invoice_date)) return row.invoice_date.slice(0, 7);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(new Date(row.created_at)).slice(0, 7);
}

function sar(n: number) {
  return n.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

export function InvoicesAdmin() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [employee, setEmployee] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/purchase-invoices");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Could not load invoices");
    setInvoices(data.invoices ?? []);
  }

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, []);

  const names = useMemo(
    () => [...new Set(invoices.map((r) => r.employee_name || "").filter(Boolean))].sort(),
    [invoices]
  );

  const rows = invoices.filter((r) => monthKey(r) === month && (!employee || r.employee_name === employee));
  const counted = rows.filter((r) => r.status === "submitted");
  const totals = counted.reduce(
    (s, r) => ({
      net: s.net + r.amount_without_vat,
      vat: s.vat + r.vat_amount,
      gross: s.gross + r.amount_with_vat,
    }),
    { net: 0, vat: 0, gross: 0 }
  );

  async function setStatus(id: string, status: "submitted" | "rejected") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/purchase-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Update failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Purchase invoices</h1>
          <p className="mt-1 text-sm text-zinc-600">
            VAT totals come from the invoice QR. Scan that QR in the ZATCA app. Rejected invoices are not deducted.
          </p>
        </div>
        <a
          href={`/api/purchase-invoices/export?month=${month}`}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Download {month} Excel
        </a>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <input type="month" className="rounded border border-zinc-300 px-2 py-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
        <select className="rounded border border-zinc-300 px-2 py-2 text-sm" value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="">All employees</option>
          {names.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">Without VAT</p>
          <p className="mt-1 text-xl font-semibold">{sar(totals.net)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">VAT</p>
          <p className="mt-1 text-xl font-semibold">{sar(totals.vat)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs uppercase text-zinc-500">With VAT</p>
          <p className="mt-1 text-xl font-semibold">{sar(totals.gross)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {rows.map((r) => (
          <article key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-zinc-900">{r.employee_name} · {r.invoice_number || "No number"}</p>
                <p className="text-sm text-zinc-600">{r.seller_name || "Seller not read"} · {r.invoice_date || r.created_at.slice(0, 10)}</p>
                <p className="mt-1 text-sm">
                  {r.is_vat ? "VAT" : "Non-VAT"} · without {sar(r.amount_without_vat)} · VAT {sar(r.vat_amount)} · paid {sar(r.amount_with_vat)}
                  {r.status === "rejected" ? " · rejected" : ""}
                </p>
                {r.amount_mismatch ? (
                  <p className="mt-1 text-sm text-amber-700">Printed total and QR total do not match. Check the photo.</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => setStatus(r.id, r.status === "rejected" ? "submitted" : "rejected")}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
              >
                {r.status === "rejected" ? "Restore deduction" : "Reject"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {r.image_url ? (
                <a href={r.image_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image_url} alt="Invoice" className="h-40 w-auto rounded border border-zinc-200 object-contain" />
                </a>
              ) : null}
              {r.is_vat && r.qr_payload ? (
                <div>
                  <p className="mb-1 text-xs text-zinc-500">Scan in the ZATCA app</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/purchase-invoices/${r.id}/qr`} alt="Invoice QR" className="h-40 w-40 bg-white" />
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {rows.length === 0 ? <p className="text-sm text-zinc-500">No invoices in {month}.</p> : null}
      </div>
    </div>
  );
}
