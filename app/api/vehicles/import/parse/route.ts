import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import {
  appendPreviewRowError,
  fetchVehiclePlatesLowerSet,
  flagCsvDuplicateKeys,
} from "@/lib/data-uniqueness";

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (inQuotes) cur += c;
    else if (c === ",") { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const rawHeaders = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/\./g, ""));
  const rows = lines.slice(1).map((l) => parseCSVLine(l).map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers, rows };
}

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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

  const hasPlateColumn = headers.includes("plate_number") || headers.includes("vehicle_plate_no");
  if (!hasPlateColumn) {
    return NextResponse.json({
      message: "CSV must have header plate_number. Optional: vehicle_type, rent_company, make, model, assignment_type. (Legacy alias: vehicle_plate_no.)",
      previewRows: [],
    }, { status: 400 });
  }

  const previewRows: Array<{
    plate_number: string;
    vehicle_type: string;
    rent_company: string;
    make: string;
    model: string;
    assignment_type: string;
    _payload: {
      plate_number: string;
      vehicle_type: string | null;
      rent_company: string | null;
      make: string | null;
      model: string | null;
      assignment_type: "Temporary" | "Permanent";
    };
    _error?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const plate_number = col(row, "plate_number") || col(row, "vehicle_plate_no");
    const vehicle_type = col(row, "vehicle_type");
    const rent_company = col(row, "rent_company");
    const make = col(row, "make");
    const model = col(row, "model");
    const assignmentTypeRaw = col(row, "assignment_type");

    const errors: string[] = [];
    if (!plate_number) errors.push("Vehicle plate no. required");
    const normalizedAssignmentType = assignmentTypeRaw
      ? assignmentTypeRaw.toLowerCase() === "temporary"
        ? "Temporary"
        : assignmentTypeRaw.toLowerCase() === "permanent"
          ? "Permanent"
          : ""
      : "Permanent";
    if (!normalizedAssignmentType) errors.push("assignment_type must be Temporary or Permanent");

    const _payload = {
      plate_number: plate_number || "",
      vehicle_type: vehicle_type || null,
      rent_company: rent_company || null,
      make: make || null,
      model: model || null,
      assignment_type: (normalizedAssignmentType || "Permanent") as "Temporary" | "Permanent",
    };

    previewRows.push({
      plate_number: plate_number || "—",
      vehicle_type: vehicle_type || "—",
      rent_company: rent_company || "—",
      make: make || "—",
      model: model || "—",
      assignment_type: normalizedAssignmentType || "—",
      _payload,
      ...(errors.length ? { _error: errors.join(". ") } : {}),
    });
  }

  flagCsvDuplicateKeys(
    previewRows,
    (r) => {
      const p = r._payload.plate_number?.trim();
      return p || null;
    },
    "vehicle plate number"
  );

  const supabase = await getDataClient();
  const platesLower = await fetchVehiclePlatesLowerSet(supabase);
  for (const r of previewRows) {
    if (r._error) continue;
    const p = r._payload.plate_number?.trim();
    if (!p) continue;
    if (platesLower.has(p.toLowerCase())) {
      appendPreviewRowError(r, "This plate number is already registered in the database.");
    }
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
    message: invalidCount > 0 ? `${validCount} row(s) valid, ${invalidCount} row(s) with errors.` : "Import ready. Review and save.",
    previewRows,
    validCount,
    invalidCount,
  });
}
