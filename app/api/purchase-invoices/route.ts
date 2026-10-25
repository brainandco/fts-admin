import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { requirePettyAdmin } from "@/lib/petty-cash/admin-auth";
import { loadPettyCashBook } from "@/lib/petty-cash/load";

export async function GET() {
  const gate = await requirePettyAdmin(false);
  if ("error" in gate) return gate.error;
  try {
    const book = await loadPettyCashBook(await getDataClient());
    return NextResponse.json({ invoices: book.invoices });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Could not load invoices" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requirePettyAdmin(true);
  if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  const id = body?.id?.trim() ?? "";
  const status = body?.status === "rejected" ? "rejected" : body?.status === "submitted" ? "submitted" : "";
  if (!id || !status) return NextResponse.json({ message: "Invoice and status are required" }, { status: 400 });

  const supabase = await getDataClient();
  if (status === "submitted") {
    const { data: existing } = await supabase
      .from("purchase_invoices")
      .select("employee_id, amount_with_vat, status")
      .eq("id", id)
      .maybeSingle();
    if (existing?.status === "rejected") {
      const book = await loadPettyCashBook(supabase);
      const bal = book.balances.find((b) => b.employeeId === existing.employee_id);
      const remaining = bal?.remaining ?? 0;
      if (Number(existing.amount_with_vat) > remaining + 0.001) {
        return NextResponse.json(
          { message: `Cannot restore. Remaining petty cash is ${remaining.toFixed(2)} SAR.` },
          { status: 400 }
        );
      }
    }
  }

  const { error } = await supabase.from("purchase_invoices").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
