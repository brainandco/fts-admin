import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDataClient } from "@/lib/supabase/server";
import { requirePettyAdmin } from "@/lib/petty-cash/admin-auth";
import { loadPettyCashBook } from "@/lib/petty-cash/load";

export async function GET() {
  const gate = await requirePettyAdmin(false);
  if ("error" in gate) return gate.error;

  let book;
  try {
    book = await loadPettyCashBook(await getDataClient());
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Could not export" }, { status: 400 });
  }

  const movements = [
    ...book.allotments.map((r) => ({
      Type: "Allotment",
      Date: r.allotted_on,
      Source: r.source,
      Person: r.allotted_by_name,
      Employee: r.employee_name ?? "",
      Amount: r.amount,
      Note: r.note ?? "",
    })),
    ...book.returns.map((r) => ({
      Type: "Return",
      Date: r.returned_on,
      Source: "",
      Person: r.received_by_name,
      Employee: r.employee_name ?? "",
      Amount: r.amount,
      Note: r.note ?? "",
    })),
  ].sort((a, b) => String(b.Date).localeCompare(String(a.Date)));

  const balances = book.balances.map((b) => ({
    Employee: b.employeeName ?? "",
    Allotted: b.allotted,
    Returned: b.returned,
    Spent: b.spent,
    Remaining: b.remaining,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movements), "Movements");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balances), "Balances");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"petty-cash.xlsx\"",
    },
  });
}
