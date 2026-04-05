import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

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
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

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

  const requiredHeaders = ["company", "category"];
  const hasRequired = requiredHeaders.every((h) => headers.includes(h));
  if (!hasRequired) {
    return NextResponse.json(
      {
        message:
          "CSV must include headers: company, category. Optional: model, serial, imei_1, imei_2, asset_id, condition, software_connectivity, ram. Category is any label you use for grouping (free text).",
        previewRows: [],
      },
      { status: 400 }
    );
  }

  type PreviewRow = {
    category: string;
    serial: string;
    model: string;
    asset_id: string;
    condition: string;
    software_connectivity: string;
    imei_1: string;
    imei_2: string;
    company: string;
    ram: string;
    _payload: {
      category: string;
      serial: string | null;
      model: string | null;
      imei_1: string | null;
      imei_2: string | null;
      asset_id: string | null;
      condition: string | null;
      software_connectivity: string | null;
      specs: Record<string, unknown>;
    };
    _error?: string;
  };

  const previewRows: PreviewRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const categoryRaw = col(row, "category");
    const serial = col(row, "serial");
    const model = col(row, "model");
    const imei_1 = col(row, "imei_1") || col(row, "imei1");
    const imei_2 = col(row, "imei_2") || col(row, "imei2");
    const asset_id = col(row, "asset_id");
    const condition = col(row, "condition");
    const software_connectivity = col(row, "software_connectivity");
    const company = col(row, "company") || col(row, "spec_company");
    const ram = col(row, "ram") || col(row, "spec_ram");

    const categoryTrimmed = categoryRaw.trim();
    const errors: string[] = [];
    if (!company.trim()) errors.push("Company required");
    if (!categoryTrimmed) errors.push("Category required");

    const specs: Record<string, unknown> = {};
    if (company.trim()) specs.company = company.trim();
    if (ram.trim()) specs.ram = ram.trim();

    const _payload = {
      category: categoryTrimmed,
      serial: serial.trim() || null,
      model: model.trim() || null,
      imei_1: imei_1.trim() || null,
      imei_2: imei_2.trim() || null,
      asset_id: asset_id.trim() || null,
      condition: condition.trim() || null,
      software_connectivity: software_connectivity.trim() || null,
      specs,
    };

    previewRows.push({
      category: categoryTrimmed || "—",
      serial: serial || "—",
      model: model || "—",
      imei_1: imei_1 || "—",
      imei_2: imei_2 || "—",
      asset_id: asset_id || "—",
      condition: condition || "—",
      software_connectivity: software_connectivity || "—",
      company: company || "—",
      ram: ram || "—",
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
        : "Import ready. Review and save.",
    previewRows,
    validCount,
    invalidCount,
  });
}
