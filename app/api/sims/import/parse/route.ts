import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import {
  appendPreviewRowError,
  fetchExistingSimNumbers,
  flagCsvDuplicateKeys,
} from "@/lib/data-uniqueness";
import { normalizeHeaderDefault, parseImportFile } from "@/lib/import/spreadsheet";

export async function POST(req: Request) {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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

  const requiredHeaders = ["operator", "service_type", "sim_number"];
  if (!requiredHeaders.every((h) => headers.includes(h))) {
    return NextResponse.json(
      {
        message: "The file must include headers: operator, service_type, sim_number. Optional: phone_number, notes.",
        previewRows: [],
      },
      { status: 400 }
    );
  }

  type PreviewRow = {
    operator: string;
    service_type: string;
    sim_number: string;
    phone_number: string;
    notes: string;
    _payload: {
      operator: string;
      service_type: "Data" | "Voice" | "Data+Voice";
      sim_number: string;
      phone_number: string | null;
      notes: string | null;
    };
    _error?: string;
  };

  const previewRows: PreviewRow[] = [];
  const allowed = new Set(["Data", "Voice", "Data+Voice"]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const operator = col(row, "operator");
    const service_type = col(row, "service_type");
    const sim_number = col(row, "sim_number");
    const phone_number = col(row, "phone_number");
    const notes = col(row, "notes");

    const errors: string[] = [];
    if (!operator) errors.push("Operator required");
    if (!service_type) errors.push("service_type required");
    if (service_type && !allowed.has(service_type)) errors.push("service_type must be Data, Voice, or Data+Voice");
    if (!sim_number) errors.push("sim_number required");

    previewRows.push({
      operator: operator || "—",
      service_type: service_type || "—",
      sim_number: sim_number || "—",
      phone_number: phone_number || "—",
      notes: notes || "—",
      _payload: {
        operator,
        service_type: (service_type as "Data" | "Voice" | "Data+Voice") || "Data",
        sim_number,
        phone_number: phone_number || null,
        notes: notes || null,
      },
      ...(errors.length ? { _error: errors.join(". ") } : {}),
    });
  }

  flagCsvDuplicateKeys(
    previewRows,
    (r) => {
      const s = r._payload.sim_number?.trim();
      return s || null;
    },
    "SIM number"
  );

  const supabase = await getDataClient();
  const candidateSims = previewRows
    .filter((r) => !r._error && r._payload.sim_number.trim())
    .map((r) => r._payload.sim_number.trim());
  const existingSims = await fetchExistingSimNumbers(supabase, candidateSims);
  for (const r of previewRows) {
    if (r._error) continue;
    const sn = r._payload.sim_number.trim();
    if (!sn) continue;
    if (existingSims.has(sn)) {
      appendPreviewRowError(r, "This SIM number already exists in the database.");
    }
  }

  const validCount = previewRows.filter((r) => !r._error).length;
  const invalidCount = previewRows.length - validCount;
  if (invalidCount > 0 && validCount === 0) {
    return NextResponse.json(
      { message: `All ${previewRows.length} rows have errors. Fix the file and try again.`, previewRows },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: invalidCount > 0
      ? `${validCount} row(s) valid, ${invalidCount} row(s) with errors. You can save valid rows only.`
      : "Import ready. Review and save.",
    previewRows,
    validCount,
    invalidCount,
  });
}
