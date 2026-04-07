import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { fetchExistingSimNumbers } from "@/lib/data-uniqueness";

const CHUNK_SIZE = 120;

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await getDataClient();
  const insertedIds: string[] = [];
  const errors: { row: number; message: string }[] = [];
  const allowed = new Set(["Data", "Voice", "Data+Voice"]);

  type Prepared = { csvRow: number; insert: Record<string, unknown> };

  const prepared: Prepared[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const csvRow = i + 1;
    const operator = typeof r.operator === "string" ? r.operator.trim() : "";
    const service_type = typeof r.service_type === "string" ? r.service_type.trim() : "";
    const sim_number = typeof r.sim_number === "string" ? r.sim_number.trim() : "";
    const phone_number = typeof r.phone_number === "string" ? r.phone_number.trim() || null : r.phone_number ?? null;
    const notes = typeof r.notes === "string" ? r.notes.trim() || null : r.notes ?? null;

    if (!operator || !service_type || !sim_number) {
      errors.push({ row: csvRow, message: "operator, service_type, sim_number required" });
      continue;
    }
    if (!allowed.has(service_type)) {
      errors.push({ row: csvRow, message: "service_type must be Data, Voice, or Data+Voice" });
      continue;
    }

    prepared.push({
      csvRow,
      insert: {
        operator,
        service_type,
        sim_number,
        phone_number,
        notes,
        status: "Available",
      },
    });
  }

  const existingSims = await fetchExistingSimNumbers(
    supabase,
    prepared.map((p) => String(p.insert.sim_number ?? ""))
  );
  const seenInFile = new Set<string>();
  const insertable: Prepared[] = [];
  for (const p of prepared) {
    const sn = String(p.insert.sim_number ?? "").trim();
    if (existingSims.has(sn)) {
      errors.push({ row: p.csvRow, message: "This SIM number already exists in the database." });
      continue;
    }
    if (seenInFile.has(sn)) {
      errors.push({
        row: p.csvRow,
        message: `Duplicate SIM number in this import (same as an earlier row in the file).`,
      });
      continue;
    }
    seenInFile.add(sn);
    insertable.push(p);
  }

  for (let start = 0; start < insertable.length; start += CHUNK_SIZE) {
    const slice = insertable.slice(start, start + CHUNK_SIZE);
    const batch = slice.map((p) => p.insert);
    const { data: batchData, error: batchError } = await supabase.from("sim_cards").insert(batch).select("id");

    if (!batchError && batchData && batchData.length === batch.length) {
      for (const row of batchData) {
        if (row?.id) insertedIds.push(row.id as string);
      }
      continue;
    }

    for (const p of slice) {
      const { data: one, error: oneErr } = await supabase.from("sim_cards").insert(p.insert).select("id").single();
      if (oneErr) {
        errors.push({ row: p.csvRow, message: oneErr.message });
      } else if (one?.id) {
        insertedIds.push(one.id as string);
      }
    }
  }

  if (insertedIds.length > 0) {
    await auditLog({
      actionType: "create",
      entityType: "sim_card",
      entityId: null,
      description: `SIM card CSV import: ${insertedIds.length} row(s) inserted`,
      meta: { source: "import_save", insertedCount: insertedIds.length, failedCount: errors.length },
    });
  }

  return NextResponse.json({
    inserted: insertedIds.length,
    insertedIds,
    errors: errors.length ? errors : undefined,
  });
}
