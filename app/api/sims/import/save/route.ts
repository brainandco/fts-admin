import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to import" }, { status: 400 });

  const supabase = await getDataClient();
  const inserted: string[] = [];
  const errors: { row: number; message: string }[] = [];
  const allowed = new Set(["Data", "Voice", "Data+Voice"]);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const operator = typeof r.operator === "string" ? r.operator.trim() : "";
    const service_type = typeof r.service_type === "string" ? r.service_type.trim() : "";
    const sim_number = typeof r.sim_number === "string" ? r.sim_number.trim() : "";
    const phone_number = typeof r.phone_number === "string" ? r.phone_number.trim() || null : r.phone_number ?? null;
    const notes = typeof r.notes === "string" ? r.notes.trim() || null : r.notes ?? null;

    if (!operator || !service_type || !sim_number) {
      errors.push({ row: i + 1, message: "operator, service_type, sim_number required" });
      continue;
    }
    if (!allowed.has(service_type)) {
      errors.push({ row: i + 1, message: "service_type must be Data, Voice, or Data+Voice" });
      continue;
    }

    const insert = {
      operator,
      service_type,
      sim_number,
      phone_number,
      notes,
      status: "Available",
    };
    const { data, error } = await supabase.from("sim_cards").insert(insert).select("id").single();
    if (error) {
      errors.push({ row: i + 1, message: error.message });
      continue;
    }
    inserted.push(data.id);
    await auditLog({
      actionType: "create",
      entityType: "sim_card",
      entityId: data.id,
      newValue: insert,
      description: "SIM card imported",
    });
  }

  return NextResponse.json({
    inserted: inserted.length,
    insertedIds: inserted,
    errors: errors.length ? errors : undefined,
  });
}
