import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { QA_EMPLOYEE_PROJECT_NAME } from "@/lib/employees/qaProject";

const ALLOWED_ROLES = ["Driver/Rigger", "QC", "QA", "DT", "Project Manager", "Self DT"];

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
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase().replace(/\s+/g, "_"));
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

  const supabase = await createServerSupabaseClient();
  const { data: regions } = await supabase.from("regions").select("id, name");
  const { data: projects } = await supabase.from("projects").select("id, name");
  const regionByName = new Map((regions ?? []).map((r) => [r.name.trim().toLowerCase(), r.id]));
  const projectByName = new Map((projects ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));

  const previewRows: Array<{
    full_name: string;
    passport_number: string;
    country: string;
    email: string;
    phone: string;
    iqama_number: string;
    roles_display: string;
    region_name: string;
    project_name: string;
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
      region_id: string | null;
      project_id: string | null;
      project_name_other: string | null;
      onboarding_date: string | null;
      status: string;
    };
    _error?: string;
  }> = [];

  const possibleHeaders = [
    "full_name", "passport_number", "country", "email", "phone", "iqama_number",
    "roles", "region", "project", "project_name_other", "onboarding_date", "status"
  ];
  const hasRequired = possibleHeaders.slice(0, 7).every((h) => headers.includes(h));
  if (!hasRequired) {
    return NextResponse.json({
      message: "CSV must have headers: full_name, passport_number, country, email, phone, iqama_number, roles, region, project (and optionally project_name_other, onboarding_date, status). Use semicolons in roles e.g. DT;Driver/Rigger.",
      previewRows: [],
    }, { status: 400 });
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
    const regionInput = col(row, "region");
    const projectInput = col(row, "project");
    const project_name_other = col(row, "project_name_other");
    const onboarding_date = col(row, "onboarding_date") || null;
    const status = (col(row, "status") || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const roles = rolesRaw ? rolesRaw.split(/[;,|]/).map((r) => r.trim()).filter((r) => ALLOWED_ROLES.includes(r)) : [];
    const region_id = regionInput ? (regionByName.get(regionInput.toLowerCase()) ?? null) : null;
    const isOther = projectInput.trim().toUpperCase() === "OTHER" || projectInput.trim().toLowerCase() === "other";
    const project_id = !isOther && projectInput ? (projectByName.get(projectInput.toLowerCase()) ?? null) : null;
    const project_name_other_val = isOther ? (project_name_other || null) : null;

    const region_name = ((regions ?? []).find((r) => r.id === region_id)?.name ?? regionInput) || "—";
    const isOnlyQa = roles.length === 1 && roles[0] === "QA";
    const project_name = isOnlyQa
      ? QA_EMPLOYEE_PROJECT_NAME
      : isOther
        ? project_name_other || "Other"
        : (((projects ?? []).find((p) => p.id === project_id)?.name ?? projectInput) || "—");

    const errors: string[] = [];
    if (!full_name) errors.push("Full name required");
    if (!passport_number) errors.push("Passport required");
    if (!country) errors.push("Country required");
    if (!email) errors.push("Email required");
    if (!phone) errors.push("Phone required");
    if (!iqama_number) errors.push("Iqama number required");
    if (roles.length === 0) errors.push("At least one role required (DT, Driver/Rigger, Self DT, QC, QA, Project Manager)");
    if (!region_id) errors.push(regionInput ? "Region name not found" : "Region required");
    if (!isOnlyQa) {
      if (!isOther && !project_id && projectInput) errors.push("Project name not found");
      if (!project_id && !project_name_other_val) {
        errors.push(isOther ? "project_name_other required when project is OTHER" : "Project or Other project name required");
      }
    }

    const _payload = {
      full_name,
      passport_number,
      country,
      email,
      phone,
      iqama_number,
      roles,
      region_id,
      project_id,
      project_name_other: project_name_other_val,
      onboarding_date: onboarding_date || null,
      status,
    };

    previewRows.push({
      full_name: full_name || "—",
      passport_number: passport_number || "—",
      country: country || "—",
      email: email || "—",
      phone: phone || "—",
      iqama_number: iqama_number || "—",
      roles_display: roles.length ? roles.join(", ") : "—",
      region_name,
      project_name: project_name || "—",
      onboarding_date: onboarding_date || null,
      status,
      _payload,
      ...(errors.length ? { _error: errors.join(". ") } : {}),
    });
  }

  const validCount = previewRows.filter((r) => !r._error).length;
  const invalidCount = previewRows.length - validCount;
  if (invalidCount > 0 && validCount === 0) {
    return NextResponse.json({
      message: `All ${previewRows.length} rows have errors. Fix the CSV and try again.`,
      previewRows,
    }, { status: 400 });
  }

  return NextResponse.json({
    message: invalidCount > 0 ? `${validCount} row(s) valid, ${invalidCount} row(s) with errors. You can save valid rows only.` : "Import ready. Review and save.",
    previewRows,
    validCount,
    invalidCount,
  });
}
