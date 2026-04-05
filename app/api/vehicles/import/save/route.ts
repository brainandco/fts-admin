import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const inserted: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const plate_number = typeof r.plate_number === "string" ? r.plate_number.trim() : "";
    if (!plate_number) {
      errors.push({ row: i + 1, message: "Vehicle plate no. required" });
      continue;
    }
    const insert = {
      plate_number,
      vehicle_type: r.vehicle_type || null,
      rent_company: r.rent_company || null,
      make: r.make || null,
      model: r.model || null,
      assignment_type: r.assignment_type === "Temporary" ? "Temporary" : "Permanent",
      status: "Available",
      purchase_image_urls: [] as unknown[],
    };
    const { data, error } = await supabase.from("vehicles").insert(insert).select("id").single();
    if (error) {
      errors.push({ row: i + 1, message: error.message });
      continue;
    }
    await auditLog({ actionType: "create", entityType: "vehicle", entityId: data.id, newValue: insert, description: "Vehicle imported" });
    inserted.push(data.id);
  }

  return NextResponse.json({
    inserted: inserted.length,
    insertedIds: inserted,
    errors: errors.length ? errors : undefined,
  });
}
