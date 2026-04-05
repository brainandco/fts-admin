import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";

/** Rows per INSERT; keeps payloads small and avoids long single transactions. */
const CHUNK_SIZE = 120;

export const maxDuration = 120;

function mapRowToInsert(r: unknown): { ok: true; insert: Record<string, unknown> } | { ok: false; message: string } {
  if (!r || typeof r !== "object") return { ok: false, message: "Invalid row" };
  const row = r as Record<string, unknown>;
  const categoryRaw = typeof row.category === "string" ? row.category.trim() : "";
  const serial = typeof row.serial === "string" ? row.serial.trim() || null : row.serial ?? null;
  const model = typeof row.model === "string" ? row.model.trim() || null : row.model ?? null;
  const imei_1 = typeof row.imei_1 === "string" ? row.imei_1.trim() || null : row.imei_1 ?? null;
  const imei_2 = typeof row.imei_2 === "string" ? row.imei_2.trim() || null : row.imei_2 ?? null;
  const asset_id = typeof row.asset_id === "string" ? row.asset_id.trim() || null : row.asset_id ?? null;
  const condition = typeof row.condition === "string" ? row.condition.trim() || null : row.condition ?? null;
  const software_connectivity =
    typeof row.software_connectivity === "string" ? row.software_connectivity.trim() || null : row.software_connectivity ?? null;
  const specs = row.specs && typeof row.specs === "object" && !Array.isArray(row.specs) ? (row.specs as Record<string, unknown>) : {};
  const company =
    typeof specs.company === "string" ? specs.company.trim() : typeof row.name === "string" ? String(row.name).trim() : "";
  const name = company;

  if (!categoryRaw || !name) {
    return { ok: false, message: "company (in specs) and category required" };
  }

  const insert: Record<string, unknown> = {
    asset_id,
    name,
    category: categoryRaw,
    serial,
    model,
    imei_1,
    imei_2,
    condition,
    software_connectivity,
    status: "Available",
    specs,
    purchase_image_urls: [],
  };

  return { ok: true, insert };
}

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await getDataClient();

  type Prepared = { csvRow: number; insert: Record<string, unknown> };
  const prepared: Prepared[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const csvRow = i + 1;
    const mapped = mapRowToInsert(rows[i]);
    if (!mapped.ok) {
      errors.push({ row: csvRow, message: mapped.message });
      continue;
    }
    prepared.push({ csvRow, insert: mapped.insert });
  }

  const insertedIds: string[] = [];

  for (let start = 0; start < prepared.length; start += CHUNK_SIZE) {
    const slice = prepared.slice(start, start + CHUNK_SIZE);
    const batch = slice.map((p) => p.insert);

    const { data: batchData, error: batchError } = await supabase.from("assets").insert(batch).select("id");

    if (!batchError && batchData && batchData.length === batch.length) {
      for (const row of batchData) {
        if (row?.id) insertedIds.push(row.id as string);
      }
      continue;
    }

    for (const p of slice) {
      const { data: one, error: oneErr } = await supabase.from("assets").insert(p.insert).select("id").single();
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
      entityType: "asset",
      entityId: null,
      description: `Asset CSV import: ${insertedIds.length} row(s) inserted`,
      meta: { source: "import_save", insertedCount: insertedIds.length, failedCount: errors.length },
    });
  }

  return NextResponse.json({
    inserted: insertedIds.length,
    insertedIds,
    errors: errors.length ? errors : undefined,
  });
}
