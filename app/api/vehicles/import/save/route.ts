import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { fetchVehiclePlatesLowerSet } from "@/lib/data-uniqueness";

const CHUNK_SIZE = 120;

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await getDataClient();
  const insertedIds: string[] = [];
  const errors: { row: number; message: string }[] = [];

  type Prepared = { csvRow: number; insert: Record<string, unknown> };

  const prepared: Prepared[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const csvRow = i + 1;
    const plate_number = typeof r.plate_number === "string" ? r.plate_number.trim() : "";
    if (!plate_number) {
      errors.push({ row: csvRow, message: "Vehicle plate no. required" });
      continue;
    }
    prepared.push({
      csvRow,
      insert: {
        plate_number,
        vehicle_type: r.vehicle_type || null,
        rent_company: r.rent_company || null,
        make: r.make || null,
        model: r.model || null,
        assignment_type: r.assignment_type === "Temporary" ? "Temporary" : "Permanent",
        status: "Available",
        purchase_image_urls: [] as unknown[],
      },
    });
  }

  const platesInDb = await fetchVehiclePlatesLowerSet(supabase);
  const seenPlatesLower = new Set<string>();
  const insertable: typeof prepared = [];
  for (const p of prepared) {
    const pl = String(p.insert.plate_number ?? "").trim().toLowerCase();
    if (platesInDb.has(pl)) {
      errors.push({ row: p.csvRow, message: "This plate number is already registered in the database." });
      continue;
    }
    if (seenPlatesLower.has(pl)) {
      errors.push({
        row: p.csvRow,
        message: "Duplicate plate number in this import (same as an earlier row in the file).",
      });
      continue;
    }
    seenPlatesLower.add(pl);
    insertable.push(p);
  }

  for (let start = 0; start < insertable.length; start += CHUNK_SIZE) {
    const slice = insertable.slice(start, start + CHUNK_SIZE);
    const batch = slice.map((p) => p.insert);
    const { data: batchData, error: batchError } = await supabase.from("vehicles").insert(batch).select("id");

    if (!batchError && batchData && batchData.length === batch.length) {
      for (const row of batchData) {
        if (row?.id) insertedIds.push(row.id as string);
      }
      continue;
    }

    for (const p of slice) {
      const { data: one, error: oneErr } = await supabase.from("vehicles").insert(p.insert).select("id").single();
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
      entityType: "vehicle",
      entityId: null,
      description: `Vehicle CSV import: ${insertedIds.length} row(s) inserted`,
      meta: { source: "import_save", insertedCount: insertedIds.length, failedCount: errors.length },
    });
  }

  return NextResponse.json({
    inserted: insertedIds.length,
    insertedIds,
    errors: errors.length ? errors : undefined,
  });
}
