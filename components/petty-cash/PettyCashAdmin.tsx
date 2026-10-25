"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = { id: string; full_name: string | null };
type Allotment = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  amount: number;
  allotted_on: string;
  source: string;
  allotted_by_name: string;
  note: string | null;
};
type CashReturn = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  amount: number;
  returned_on: string;
  received_by_name: string;
  note: string | null;
};
type Balance = {
  employeeId: string;
  employeeName: string | null;
  allotted: number;
  returned: number;
  spent: number;
  remaining: number;
};

function sar(n: number) {
  return n.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PettyCashAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [returns, setReturns] = useState<CashReturn[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"allotment" | "return">("allotment");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [source, setSource] = useState<"admin" | "company">("admin");
  const [allottedByName, setAllottedByName] = useState("");
  const [note, setNote] = useState("");
  const [person, setPerson] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");

  async function load() {
    const res = await fetch("/api/petty-cash");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Could not load petty cash");
    setEmployees(data.employees ?? []);
    setAllotments(data.allotments ?? []);
    setReturns(data.returns ?? []);
    setBalances(data.balances ?? []);
  }

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, []);

  const people = useMemo(
    () => [...new Set(allotments.map((r) => r.allotted_by_name).filter(Boolean))].sort(),
    [allotments]
  );

  const filtered = allotments.filter((r) => {
    if (person && r.allotted_by_name !== person) return false;
    if (employeeFilter && r.employee_id !== employeeFilter) return false;
    if (sourceFilter && r.source !== sourceFilter) return false;
    if (month && !r.allotted_on.startsWith(month)) return false;
    if (day && r.allotted_on !== day) return false;
    return true;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/petty-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          employeeId,
          amount,
          date,
          source,
          allottedByName,
          note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "Save failed");
      setAmount("");
      setNote("");
      setMessage(kind === "return" ? "Return recorded." : "Petty cash allotted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Petty cash</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Allotments and cash returned. Purchase invoices reduce the remaining balance separately.
          </p>
        </div>
        <a href="/api/petty-cash/export" className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
          Download Excel
        </a>
      </div>

      {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-3">
        <label className="text-sm text-zinc-700">
          Action
          <select className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={kind} onChange={(e) => setKind(e.target.value as "allotment" | "return")}>
            <option value="allotment">Allot</option>
            <option value="return">Record cash returned</option>
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          Employee
          <select className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name || emp.id}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-700">
          Amount (SAR)
          <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="text-sm text-zinc-700">
          Date
          <input type="date" className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {kind === "allotment" ? (
          <label className="text-sm text-zinc-700">
            Source
            <select className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={source} onChange={(e) => setSource(e.target.value as "admin" | "company")}>
              <option value="admin">Admin</option>
              <option value="company">Company</option>
            </select>
          </label>
        ) : null}
        {kind === "allotment" && source === "company" ? (
          <label className="text-sm text-zinc-700">
            Allotted by
            <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={allottedByName} onChange={(e) => setAllottedByName(e.target.value)} placeholder="Company" />
          </label>
        ) : null}
        <label className="text-sm text-zinc-700 md:col-span-3">
          Note
          <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div>
          <button disabled={busy} className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-5">
        <select className="rounded border border-zinc-300 px-2 py-2 text-sm" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Allotted by — all</option>
          {people.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select className="rounded border border-zinc-300 px-2 py-2 text-sm" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
          <option value="">Employee — all</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.full_name || emp.id}</option>
          ))}
        </select>
        <select className="rounded border border-zinc-300 px-2 py-2 text-sm" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">Source — all</option>
          <option value="admin">Admin</option>
          <option value="pm">PM</option>
          <option value="company">Company</option>
        </select>
        <input type="month" className="rounded border border-zinc-300 px-2 py-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)} />
        <input type="date" className="rounded border border-zinc-300 px-2 py-2 text-sm" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Allotted by</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">{r.allotted_on}</td>
                <td className="px-3 py-2">{r.employee_name}</td>
                <td className="px-3 py-2">{r.source}</td>
                <td className="px-3 py-2">{r.allotted_by_name}</td>
                <td className="px-3 py-2">{sar(r.amount)}</td>
                <td className="px-3 py-2">{r.note}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td className="px-3 py-4 text-zinc-500" colSpan={6}>No allotments for these filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-zinc-900">Balances</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Allotted</th>
              <th className="px-3 py-2">Returned</th>
              <th className="px-3 py-2">Spent</th>
              <th className="px-3 py-2">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.employeeId} className="border-t border-zinc-100">
                <td className="px-3 py-2">{b.employeeName}</td>
                <td className="px-3 py-2">{sar(b.allotted)}</td>
                <td className="px-3 py-2">{sar(b.returned)}</td>
                <td className="px-3 py-2">{sar(b.spent)}</td>
                <td className="px-3 py-2 font-medium">{sar(b.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-zinc-900">Cash returned</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Received by</th>
              <th className="px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">{r.returned_on}</td>
                <td className="px-3 py-2">{r.employee_name}</td>
                <td className="px-3 py-2">{r.received_by_name}</td>
                <td className="px-3 py-2">{sar(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
