import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import {
  appendPreviewRowError,
  fetchVehiclePlatesLowerSet,
  flagCsvDuplicateKeys,
} from "@/lib/data-uniqueness";
import { normalizeHeaderVehicle, parseImportFile } from "@/lib/import/spreadsheet";

export async function POST(req: Request) {
  if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  let parsed: Awaited<ReturnType<typeof parseImportFile>>;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "No file provided" }, { status: 400 });
    parsed = await parseImportFile(file, normalizeHeaderVehicle);
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

  const hasPlateColumn = headers.includes("plate_number") || headers.includes("vehicle_plate_no");
  if (!hasPlateColumn) {
    return NextResponse.json({
      message: "The file must have header plate_number. Optional: vehicle_type, rent_company, make, model, assignment_type. (Legacy alias: vehicle_plate_no.)",
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
      message: `All ${previewRows.length} rows have errors. Fix the file and try again.`,
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
