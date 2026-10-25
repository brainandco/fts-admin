import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDataClient } from "@/lib/supabase/server";
import { requirePettyAdmin } from "@/lib/petty-cash/admin-auth";
import { invoiceMonthKey, loadPettyCashBook } from "@/lib/petty-cash/load";
import { roundMoney } from "@/lib/petty-cash/money";

export async function GET(req: Request) {
  const gate = await requirePettyAdmin(false);
  if ("error" in gate) return gate.error;
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ message: "month must be YYYY-MM" }, { status: 400 });
  }

  let book;
  try {
    book = await loadPettyCashBook(await getDataClient());
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Could not export" }, { status: 400 });
  }

  const rows = book.invoices.filter((r) => r.status === "submitted" && invoiceMonthKey(r) === month);
  const sheet = rows.map((r) => ({
    "Invoice number": r.invoice_number ?? "",
    Employee: r.employee_name ?? "",
    Seller: r.seller_name ?? "",
    "VAT / Non-VAT": r.is_vat ? "VAT" : "Non-VAT",
    "Without VAT": r.amount_without_vat,
    VAT: r.vat_amount,
    "With VAT": r.amount_with_vat,
    Date: r.invoice_date ?? r.created_at.slice(0, 10),
    "Amount check": r.amount_mismatch ? "QR and printed total differ" : "",
  }));
  const totals = {
    "Invoice number": "MONTH TOTAL",
    Employee: "",
    Seller: "",
    "VAT / Non-VAT": "",
    "Without VAT": roundMoney(rows.reduce((s, r) => s + r.amount_without_vat, 0)),
    VAT: roundMoney(rows.reduce((s, r) => s + r.vat_amount, 0)),
    "With VAT": roundMoney(rows.reduce((s, r) => s + r.amount_with_vat, 0)),
    Date: month,
    "Amount check": "",
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...sheet, totals]), month);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoices-${month}.xlsx"`,
    },
  });
}
