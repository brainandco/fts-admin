import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit/log";
import { normalizeOnboardingDate } from "@/lib/employees/onboarding-date-import";
import { normalizeEmployeeRolePayload } from "@/lib/employees/employee-role-options";

const CHUNK_SIZE = 80;

export const maxDuration = 120;

type Prepared = {
  csvRow: number;
  payload: {
    full_name: string;
    passport_number: string;
    country: string;
    email: string;
    phone: string;
    iqama_number: string;
    region_id: null;
    project_id: null;
    project_name_other: null;
    onboarding_date: string | null;
    status: string;
  };
  roleNorm: { role: string; role_custom: string | null };
};

export async function POST(req: Request) {
  if (!(await can("users.create"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ message: "No rows to save" }, { status: 400 });

  const supabase = await getDataClient();
  const insertedIds: string[] = [];
  const errors: { row: number; message: string }[] = [];

  const prepared: Prepared[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const csvRow = i + 1;
    const full_name = typeof r.full_name === "string" ? r.full_name.trim() : "";
    const passport_number = typeof r.passport_number === "string" ? r.passport_number.trim() : "";
    const country = typeof r.country === "string" ? r.country.trim() : "";
    const email = typeof r.email === "string" ? r.email.trim() : "";
    const phone = typeof r.phone === "string" ? r.phone.trim() : "";
    const iqama_number = typeof r.iqama_number === "string" ? r.iqama_number.trim() : "";
    const roleNorm = normalizeEmployeeRolePayload({
      roles: r.roles,
      role_custom: r.role_custom,
    });
    if (!roleNorm.ok) {
      errors.push({ row: csvRow, message: roleNorm.message });
      continue;
    }
    const status = r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    let onboarding_date: string | null = null;
    const rawOd = r.onboarding_date;
    if (rawOd != null && String(rawOd).trim() !== "") {
      const n = normalizeOnboardingDate(String(rawOd));
      if (!n.ok) {
        errors.push({ row: csvRow, message: n.message });
        continue;
      }
      onboarding_date = n.value;
    }

    if (!full_name || !passport_number || !country || !email || !phone || !iqama_number) {
      errors.push({ row: csvRow, message: "Missing required fields" });
      continue;
    }

    prepared.push({
      csvRow,
      payload: {
        full_name,
        passport_number,
        country,
        email,
        phone,
        iqama_number,
        region_id: null,
        project_id: null,
        project_name_other: null,
        onboarding_date,
        status,
      },
      roleNorm: { role: roleNorm.role, role_custom: roleNorm.role_custom },
    });
  }

  for (let start = 0; start < prepared.length; start += CHUNK_SIZE) {
    const slice = prepared.slice(start, start + CHUNK_SIZE);
    const batchPayloads = slice.map((p) => p.payload);
    const { data: batchData, error: batchError } = await supabase.from("employees").insert(batchPayloads).select("id");

    if (!batchError && batchData && batchData.length === batchPayloads.length) {
      const roleRows = slice.map((p, idx) => ({
        employee_id: (batchData[idx] as { id: string }).id,
        role: p.roleNorm.role,
        role_custom: p.roleNorm.role_custom,
      }));
      const { error: roleErr } = await supabase.from("employee_roles").insert(roleRows);
      if (roleErr) {
        for (let idx = 0; idx < slice.length; idx++) {
          const empId = (batchData[idx] as { id: string }).id;
          const p = slice[idx];
          const { error: r1 } = await supabase.from("employee_roles").insert({
            employee_id: empId,
            role: p.roleNorm.role,
            role_custom: p.roleNorm.role_custom,
          });
          if (r1) errors.push({ row: p.csvRow, message: r1.message });
          else insertedIds.push(empId);
        }
      } else {
        for (const row of batchData) {
          if (row?.id) insertedIds.push(row.id as string);
        }
      }
      continue;
    }

    for (const p of slice) {
      const { data: one, error: oneErr } = await supabase.from("employees").insert(p.payload).select("id").single();
      if (oneErr) {
        errors.push({ row: p.csvRow, message: oneErr.message });
        continue;
      }
      if (!one?.id) continue;
      const { error: rErr } = await supabase.from("employee_roles").insert({
        employee_id: one.id,
        role: p.roleNorm.role,
        role_custom: p.roleNorm.role_custom,
      });
      if (rErr) {
        errors.push({ row: p.csvRow, message: rErr.message });
        continue;
      }
      insertedIds.push(one.id as string);
    }
  }

  if (insertedIds.length > 0) {
    await auditLog({
      actionType: "create",
      entityType: "employee",
      entityId: null,
      description: `Employee CSV import: ${insertedIds.length} row(s) inserted`,
      meta: { source: "import_save", insertedCount: insertedIds.length, failedCount: errors.length },
    });
  }

  return NextResponse.json({
    inserted: insertedIds.length,
    insertedIds,
    errors: errors.length ? errors : undefined,
  });
}
