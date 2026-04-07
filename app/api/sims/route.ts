import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { simNumberExists } from "@/lib/data-uniqueness";

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const operator = typeof body.operator === "string" ? body.operator.trim() : "";
  const service_type = typeof body.service_type === "string" ? body.service_type.trim() : "";
  const sim_number = typeof body.sim_number === "string" ? body.sim_number.trim() : "";
  if (!operator || !service_type || !sim_number) {
    return NextResponse.json({ message: "operator, service_type, sim_number required" }, { status: 400 });
  }

  const allowed = new Set(["Data", "Voice", "Data+Voice"]);
  if (!allowed.has(service_type)) {
    return NextResponse.json({ message: "service_type must be Data, Voice, or Data+Voice" }, { status: 400 });
  }

  const supabase = await getDataClient();
  if (await simNumberExists(supabase, sim_number)) {
    return NextResponse.json({ message: "This SIM number already exists." }, { status: 400 });
  }
  const insert = {
    operator,
    service_type,
    sim_number,
    phone_number: typeof body.phone_number === "string" ? body.phone_number.trim() || null : null,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    status: "Available",
  };

  const { data, error } = await supabase.from("sim_cards").insert(insert).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "sim_card", entityId: data.id, newValue: insert, description: "SIM card created" });
  return NextResponse.json({ id: data.id });
}
