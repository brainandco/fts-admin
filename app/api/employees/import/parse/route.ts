import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import {
  appendPreviewRowError,
  flagCsvDuplicateKeys,
  isCsvDuplicateSignificantValue,
  loadEmployeeIdentitySets,
} from "@/lib/data-uniqueness";
import { normalizeOnboardingDate } from "@/lib/employees/onboarding-date-import";
import { formatEmployeeRoleDisplay, parseImportRoleToken } from "@/lib/employees/employee-role-options";
import { normalizeHeaderDefault, parseImportFile } from "@/lib/import/spreadsheet";

export async function POST(req: Request) {
  if (!(await can("users.create")) && !(await can("employees.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let parsed: Awaited<ReturnType<typeof parseImportFile>>;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });
    parsed = await parseImportFile(file, normalizeHeaderDefault);
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error, previewRows: [] }, { status: 400 });
  }

  const { headers, rows } = parsed;
  const col = (row: string[], name: string) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const previewRows: Array<{
    full_name: string;
    passport_number: string;
    country: string;
    email: string;
    phone: string;
    iqama_number: string;
    roles_display: string;
    onboarding_date: string | null;
    status: string;
    _payload: {
      full_name: string;
      passport_number: string;
      country: string;
      email: string;
      phone: string;
      iqama_number: string;
      roles: string[];
      role_custom: string | null;
      region_id: null;
      project_id: null;
      project_name_other: null;
      onboarding_date: string | null;
      status: string;
    };
    _error?: string;
  }> = [];

  const requiredHeaders = ["full_name", "country", "email", "phone", "iqama_number", "roles"];
  const hasRequired = requiredHeaders.every((h) => headers.includes(h));
  if (!hasRequired) {
    return NextResponse.json(
      {
        message:
          "The file must have headers: full_name, country, email, phone, iqama_number, roles (and optionally passport_number, onboarding_date, status). passport_number may be left blank or use a placeholder like N/A — placeholders are not checked for uniqueness. Assign region and project after import on Employees → Region & project assignments. One role per row: a fixed role (e.g. DT), Other:Label, or any custom text (stored as a custom role).",
        previewRows: [],
      },
      { status: 400 }
    );
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const full_name = col(row, "full_name");
    const passport_number = col(row, "passport_number");
    const country = col(row, "country");
    const email = col(row, "email");
    const phone = col(row, "phone");
    const iqama_number = col(row, "iqama_number");
    const rolesRaw = col(row, "roles");
    const onboardingRaw = col(row, "onboarding_date");
    const status = (col(row, "status") || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const tokens = rolesRaw ? rolesRaw.split(/[;,|]/).map((r) => r.trim()).filter(Boolean) : [];

    const errors: string[] = [];
    let onboarding_date: string | null = null;
    if (onboardingRaw) {
      const normalized = normalizeOnboardingDate(onboardingRaw);
      if (!normalized.ok) errors.push(normalized.message);
      else onboarding_date = normalized.value;
    }

    let roles: string[] = [];
    let role_custom: string | null = null;

    if (tokens.length === 0) {
      errors.push("Role is required");
    } else if (tokens.length > 1) {
      errors.push("Use exactly one role per row (no multiple roles in one cell)");
    } else {
      const parsed = parseImportRoleToken(tokens[0]);
      if (!parsed.ok) errors.push(parsed.message);
      else {
        roles = [parsed.role];
        role_custom = parsed.role_custom;
      }
    }

    if (!full_name) errors.push("Full name required");
    if (!country) errors.push("Country required");
    if (!email) errors.push("Email required");
    if (!phone) errors.push("Phone required");
    if (!iqama_number) errors.push("Iqama number required");

    const roles_display =
      roles.length > 0 ? formatEmployeeRoleDisplay(roles[0], role_custom) : "—";

    const _payload = {
      full_name,
      passport_number,
      country,
      email,
      phone,
      iqama_number,
      roles,
      role_custom: role_custom ?? null,
      region_id: null as null,
      project_id: null as null,
      project_name_other: null as null,
      onboarding_date,
      status,
    };

    previewRows.push({
      full_name: full_name || "—",
      passport_number: passport_number || "—",
      country: country || "—",
      email: email || "—",
      phone: phone || "—",
      iqama_number: iqama_number || "—",
      roles_display,
      onboarding_date,
      status,
      _payload,
      ...(errors.length ? { _error: errors.join(". ") } : {}),
    });
  }

  flagCsvDuplicateKeys(
    previewRows,
    (r) => r._payload.email?.trim().toLowerCase() || null,
    "email"
  );
  flagCsvDuplicateKeys(
    previewRows,
    (r) => r._payload.passport_number?.trim() || null,
    "passport number"
  );
  flagCsvDuplicateKeys(
    previewRows,
    (r) => r._payload.iqama_number?.trim() || null,
    "Iqama number"
  );

  const supabase = await getDataClient();
  const identity = await loadEmployeeIdentitySets(supabase);
  for (const r of previewRows) {
    if (r._error) continue;
    const em = r._payload.email.trim().toLowerCase();
    if (identity.emailsLower.has(em)) {
      appendPreviewRowError(r, "This email is already used by an employee in the database.");
    }
    const pp = r._payload.passport_number.trim();
    if (isCsvDuplicateSignificantValue(pp) && identity.passports.has(pp)) {
      appendPreviewRowError(r, "This passport number is already used by an employee in the database.");
    }
    const iq = r._payload.iqama_number.trim();
    if (isCsvDuplicateSignificantValue(iq) && identity.iqamas.has(iq)) {
      appendPreviewRowError(r, "This Iqama number is already used by an employee in the database.");
    }
  }

  const validCount = previewRows.filter((r) => !r._error).length;
  const invalidCount = previewRows.length - validCount;
  if (invalidCount > 0 && validCount === 0) {
    return NextResponse.json(
      {
        message: `All ${previewRows.length} rows have errors. Fix the file and try again.`,
        previewRows,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message:
      invalidCount > 0
        ? `${validCount} row(s) valid, ${invalidCount} row(s) with errors. You can save valid rows only.`
        : "Import ready. Review and save. Set region and project on Employees → Region & project assignments after import.",
    previewRows,
    validCount,
    invalidCount,
  });
}
