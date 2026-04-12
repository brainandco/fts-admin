import * as XLSX from "xlsx";

export type NormalizeHeader = (cleanedCell: string) => string;

/** Matches most import routes: lowercase, spaces → underscores. */
export function normalizeHeaderDefault(cleanedCell: string): string {
  return cleanedCell.toLowerCase().replace(/\s+/g, "_");
}

/** Vehicle import: also strips dots from header labels (e.g. "Plate no."). */
export function normalizeHeaderVehicle(cleanedCell: string): string {
  return cleanedCell.toLowerCase().replace(/\s+/g, "_").replace(/\./g, "");
}

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

export function parseCsvTextToGrid(text: string, normalizeHeader: NormalizeHeader): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => normalizeHeader(h.replace(/^"|"$/g, "").trim()));
  const rows = lines.slice(1).map((l) => parseCSVLine(l).map((c) => c.replace(/^"|"$/g, "").trim()));
  return { headers, rows };
}

function cellToString(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "number" && Number.isFinite(c)) {
    return String(c);
  }
  return String(c).trim();
}

export function parseXlsxToGrid(buffer: ArrayBuffer, normalizeHeader: NormalizeHeader): { headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { headers: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (!matrix.length) return { headers: [], rows: [] };

  const headerRowRaw = matrix[0].map((c) => cellToString(c));
  let colCount = headerRowRaw.length;
  while (colCount > 0 && headerRowRaw[colCount - 1] === "") colCount--;
  if (colCount === 0) return { headers: [], rows: [] };

  const headers = headerRowRaw.slice(0, colCount).map((h) => normalizeHeader(h));

  const rows: string[][] = [];
  for (let r = 1; r < matrix.length; r++) {
    const raw = matrix[r] as unknown[];
    const cells = Array.from({ length: colCount }, (_, i) => cellToString(raw[i]));
    if (cells.every((c) => c === "")) continue;
    rows.push(cells);
  }

  return { headers, rows };
}

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  );
}

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return name.endsWith(".csv") || mime === "text/csv" || mime === "text/plain";
}

export type ParseImportFileResult =
  | { ok: true; headers: string[]; rows: string[][] }
  | { ok: false; error: string };

export async function parseImportFile(file: File, normalizeHeader: NormalizeHeader): Promise<ParseImportFileResult> {
  if (isExcelFile(file)) {
    try {
      const buf = await file.arrayBuffer();
      const { headers, rows } = parseXlsxToGrid(buf, normalizeHeader);
      return { ok: true, headers, rows };
    } catch {
      return { ok: false, error: "Could not read the Excel file. Try saving as .xlsx and upload again." };
    }
  }

  if (isCsvFile(file)) {
    try {
      const text = await file.text();
      const { headers, rows } = parseCsvTextToGrid(text, normalizeHeader);
      return { ok: true, headers, rows };
    } catch {
      return { ok: false, error: "Could not read the CSV file." };
    }
  }

  return {
    ok: false,
    error: "Unsupported file type. Use CSV or Excel (.csv, .xlsx, .xls).",
  };
}
