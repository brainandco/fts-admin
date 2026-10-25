import type { SupabaseClient } from "@supabase/supabase-js";
import { pettyRemaining, roundMoney } from "@/lib/petty-cash/money";

export type AllotmentRow = {
  id: string;
  employee_id: string;
  amount: number;
  allotted_on: string;
  source: string;
  allotted_by_name: string;
  note: string | null;
  employee_name: string | null;
};

export type ReturnRow = {
  id: string;
  employee_id: string;
  amount: number;
  returned_on: string;
  received_by_name: string;
  note: string | null;
  employee_name: string | null;
};

export type InvoiceRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  status: string;
  is_vat: boolean;
  invoice_number: string | null;
  seller_name: string | null;
  seller_vat_number: string | null;
  invoice_date: string | null;
  amount_without_vat: number;
  vat_amount: number;
  amount_with_vat: number;
  qr_payload: string | null;
  image_url: string | null;
  amount_mismatch: boolean;
  created_at: string;
};

function num(v: unknown): number {
  return roundMoney(Number(v));
}

export async function loadPettyCashBook(supabase: SupabaseClient) {
  const [employeesRes, allotRes, returnRes, invoiceRes] = await Promise.all([
    supabase.from("employees").select("id, full_name, status").order("full_name"),
    supabase
      .from("petty_cash_allotments")
      .select("id, employee_id, amount, allotted_on, source, allotted_by_name, note")
      .order("allotted_on", { ascending: false })
      .limit(5000),
    supabase
      .from("petty_cash_returns")
      .select("id, employee_id, amount, returned_on, received_by_name, note")
      .order("returned_on", { ascending: false })
      .limit(5000),
    supabase
      .from("purchase_invoices")
      .select(
        "id, employee_id, status, is_vat, invoice_number, seller_name, seller_vat_number, invoice_date, amount_without_vat, vat_amount, amount_with_vat, qr_payload, image_url, amount_mismatch, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  const err = employeesRes.error || allotRes.error || returnRes.error || invoiceRes.error;
  if (err) throw new Error(err.message);

  const names = new Map((employeesRes.data ?? []).map((e) => [e.id as string, (e.full_name as string | null) ?? null]));
  const allotments: AllotmentRow[] = (allotRes.data ?? []).map((r) => ({
    id: r.id as string,
    employee_id: r.employee_id as string,
    amount: num(r.amount),
    allotted_on: r.allotted_on as string,
    source: r.source as string,
    allotted_by_name: r.allotted_by_name as string,
    note: (r.note as string | null) ?? null,
    employee_name: names.get(r.employee_id as string) ?? null,
  }));
  const returns: ReturnRow[] = (returnRes.data ?? []).map((r) => ({
    id: r.id as string,
    employee_id: r.employee_id as string,
    amount: num(r.amount),
    returned_on: r.returned_on as string,
    received_by_name: r.received_by_name as string,
    note: (r.note as string | null) ?? null,
    employee_name: names.get(r.employee_id as string) ?? null,
  }));
  const invoices: InvoiceRow[] = (invoiceRes.data ?? []).map((r) => ({
    id: r.id as string,
    employee_id: r.employee_id as string,
    employee_name: names.get(r.employee_id as string) ?? null,
    status: r.status as string,
    is_vat: Boolean(r.is_vat),
    invoice_number: (r.invoice_number as string | null) ?? null,
    seller_name: (r.seller_name as string | null) ?? null,
    seller_vat_number: (r.seller_vat_number as string | null) ?? null,
    invoice_date: (r.invoice_date as string | null) ?? null,
    amount_without_vat: num(r.amount_without_vat),
    vat_amount: num(r.vat_amount),
    amount_with_vat: num(r.amount_with_vat),
    qr_payload: (r.qr_payload as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    amount_mismatch: Boolean(r.amount_mismatch),
    created_at: r.created_at as string,
  }));

  const totals = new Map<string, { allotted: number; returned: number; spent: number }>();
  const bump = (id: string) => {
    if (!totals.has(id)) totals.set(id, { allotted: 0, returned: 0, spent: 0 });
    return totals.get(id)!;
  };
  for (const row of allotments) bump(row.employee_id).allotted = roundMoney(bump(row.employee_id).allotted + row.amount);
  for (const row of returns) bump(row.employee_id).returned = roundMoney(bump(row.employee_id).returned + row.amount);
  for (const row of invoices) {
    if (row.status !== "submitted") continue;
    bump(row.employee_id).spent = roundMoney(bump(row.employee_id).spent + row.amount_with_vat);
  }

  const balances = [...totals.entries()].map(([employeeId, t]) => ({
    employeeId,
    employeeName: names.get(employeeId) ?? null,
    ...t,
    remaining: pettyRemaining(t.allotted, t.returned, t.spent),
  }));

  const employees = (employeesRes.data ?? [])
    .filter((e) => e.status === "ACTIVE")
    .map((e) => ({ id: e.id as string, full_name: (e.full_name as string | null) ?? null }));

  return { employees, allotments, returns, invoices, balances };
}

export function invoiceMonthKey(row: { invoice_date: string | null; created_at: string }): string {
  if (row.invoice_date && /^\d{4}-\d{2}/.test(row.invoice_date)) return row.invoice_date.slice(0, 7);
  const d = new Date(row.created_at);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
}
