import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { normalizeOnboardingDate } from "@/lib/employees/onboarding-date-import";
import { formatEmployeeRoleDisplay, parseImportRoleToken } from "@/lib/employees/employee-role-options";

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) =>
    h.replace(/^"|"$/g, "").trim().toLowerCase().replace(/\s+/g, "_")
  );
  const rows = lines.slice(1).map((l) => parseCSVLine(l).map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers, rows };
}

export async function POST(req: Request) {
  if (!(await can("users.create"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  let text: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });
    text = await file.text();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const { headers, rows } = parseCSV(text);
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

  const requiredHeaders = [
    "full_name",
    "passport_number",
    "country",
    "email",
    "phone",
    "iqama_number",
    "roles",
  ];
  const hasRequired = requiredHeaders.every((h) => headers.includes(h));
  if (!hasRequired) {
    return NextResponse.json(
      {
        message:
          "CSV must have headers: full_name, passport_number, country, email, phone, iqama_number, roles (and optionally onboarding_date, status). Assign region and project after import on Employees → Region & project assignments. One role per row: a fixed role (e.g. DT), Other:Label, or any custom text (stored as a custom role).",
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
    if (!passport_number) errors.push("Passport required");
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

  const validCount = previewRows.filter((r) => !r._error).length;
  const invalidCount = previewRows.length - validCount;
  if (invalidCount > 0 && validCount === 0) {
    return NextResponse.json(
      {
        message: `All ${previewRows.length} rows have errors. Fix the CSV and try again.`,
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
