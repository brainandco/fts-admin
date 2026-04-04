import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

const ALLOWED_ROLES = [
  "Driver/Rigger",
  "QC",
  "QA",
  "PP",
  "DT",
  "Project Manager",
  "Self DT",
  "Project Coordinator",
];

export async function POST(req: Request) {
  if (!(await can("users.create"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to save" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const inserted: string[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const full_name = typeof r.full_name === "string" ? r.full_name.trim() : "";
    const passport_number = typeof r.passport_number === "string" ? r.passport_number.trim() : "";
    const country = typeof r.country === "string" ? r.country.trim() : "";
    const email = typeof r.email === "string" ? r.email.trim() : "";
    const phone = typeof r.phone === "string" ? r.phone.trim() : "";
    const iqama_number = typeof r.iqama_number === "string" ? r.iqama_number.trim() : "";
    const roles = Array.isArray(r.roles) ? r.roles.filter((x: string) => ALLOWED_ROLES.includes(x)) : [];
    const onboarding_date = r.onboarding_date || null;
    const status = r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    if (!full_name || !passport_number || !country || !email || !phone || !iqama_number || roles.length === 0) {
      errors.push({ row: i + 1, message: "Missing required fields or invalid roles" });
      continue;
    }

    const payload = {
      full_name,
      passport_number,
      country,
      email,
      phone,
      iqama_number,
      region_id: null as null,
      project_id: null as null,
      project_name_other: null as null,
      onboarding_date,
      status,
    };

    const { data, error } = await supabase.from("employees").insert(payload).select("id").single();
    if (error) {
      errors.push({ row: i + 1, message: error.message });
      continue;
    }
    for (const role of roles) {
      await supabase.from("employee_roles").insert({ employee_id: data.id, role });
    }
    await auditLog({
      actionType: "create",
      entityType: "employee",
      entityId: data.id,
      newValue: payload,
      description: "Employee imported",
    });
    inserted.push(data.id);
  }

  return NextResponse.json({
    inserted: inserted.length,
    insertedIds: inserted,
    errors: errors.length ? errors : undefined,
  });
}
