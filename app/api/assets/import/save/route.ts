import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const inserted: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const categoryRaw = typeof r.category === "string" ? r.category.trim() : "";
    const serial = typeof r.serial === "string" ? r.serial.trim() || null : r.serial ?? null;
    const model = typeof r.model === "string" ? r.model.trim() || null : r.model ?? null;
    const imei_1 = typeof r.imei_1 === "string" ? r.imei_1.trim() || null : r.imei_1 ?? null;
    const imei_2 = typeof r.imei_2 === "string" ? r.imei_2.trim() || null : r.imei_2 ?? null;
    const asset_id = typeof r.asset_id === "string" ? r.asset_id.trim() || null : r.asset_id ?? null;
    const purchase_date = r.purchase_date || null;
    const warranty_end = r.warranty_end || null;
    const condition = typeof r.condition === "string" ? r.condition.trim() || null : r.condition ?? null;
    const software_connectivity =
      typeof r.software_connectivity === "string" ? r.software_connectivity.trim() || null : r.software_connectivity ?? null;
    const specs = r.specs && typeof r.specs === "object" && !Array.isArray(r.specs) ? (r.specs as Record<string, unknown>) : {};

    if (!name || !categoryRaw) {
      errors.push({ row: i + 1, message: "name and category required" });
      continue;
    }

    const insert: Record<string, unknown> = {
      asset_id,
      name,
      category: categoryRaw,
      serial,
      model,
      imei_1,
      imei_2,
      purchase_date,
      warranty_end,
      condition,
      software_connectivity,
      status: "Available",
      specs,
    };

    const { data, error } = await supabase.from("assets").insert(insert).select("id").single();
    if (error) {
      errors.push({ row: i + 1, message: error.message });
      continue;
    }
    await auditLog({
      actionType: "create",
      entityType: "asset",
      entityId: data.id,
      newValue: insert,
      description: "Asset imported",
    });
    inserted.push(data.id);
  }

  return NextResponse.json({
    inserted: inserted.length,
    insertedIds: inserted,
    errors: errors.length ? errors : undefined,
  });
}
