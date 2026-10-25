import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { requirePettyAdmin } from "@/lib/petty-cash/admin-auth";
import { loadPettyCashBook } from "@/lib/petty-cash/load";
import { riyadhToday, roundMoney } from "@/lib/petty-cash/money";

export async function GET() {
  const gate = await requirePettyAdmin(false);
  if ("error" in gate) return gate.error;
  try {
    const book = await loadPettyCashBook(await getDataClient());
    return NextResponse.json(book);
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "Could not load petty cash" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const gate = await requirePettyAdmin(true);
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });

  const kind = body.kind === "return" ? "return" : "allotment";
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const amount = roundMoney(Number(body.amount));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const dayRaw = typeof body.date === "string" ? body.date.trim() : "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : riyadhToday();
  if (!employeeId) return NextResponse.json({ message: "Employee is required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ message: "Enter a valid amount" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: target } = await supabase.from("employees").select("id, status").eq("id", employeeId).maybeSingle();
  if (!target || target.status !== "ACTIVE") {
    return NextResponse.json({ message: "Employee is not active" }, { status: 400 });
  }

  if (kind === "return") {
    const received = typeof body.receivedBy === "string" && body.receivedBy.trim() ? body.receivedBy.trim().slice(0, 120) : gate.name;
    const { error } = await supabase.from("petty_cash_returns").insert({
      employee_id: employeeId,
      amount,
      returned_on: day,
      received_by_name: received,
      note: note || null,
    });
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const source = body.source === "company" ? "company" : "admin";
  const allottedBy =
    source === "company"
      ? typeof body.allottedByName === "string" && body.allottedByName.trim()
        ? body.allottedByName.trim().slice(0, 120)
        : "Company"
      : gate.name;

  const { error } = await supabase.from("petty_cash_allotments").insert({
    employee_id: employeeId,
    amount,
    allotted_on: day,
    source,
    allotted_by_user_id: gate.userId,
    allotted_by_name: allottedBy,
    note: note || null,
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
