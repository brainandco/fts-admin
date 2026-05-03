import type { SupabaseClient } from "@supabase/supabase-js";

/** Append a validation message on import preview rows (and similar). */
export function appendPreviewRowError(row: { _error?: string }, message: string): void {
  row._error = row._error ? `${row._error}. ${message}` : message;
}

/**
 * False for empty, N/A-style placeholders, dash-only, and punctuation-only values.
 * Used so many rows can share "N/A" for missing IMEI/serial/etc. without duplicate errors.
 */
export function isCsvDuplicateSignificantValue(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const t = String(raw).trim();
  if (!t) return false;
  const lower = t.toLowerCase().replace(/\s+/g, " ").trim();
  const exactPlaceholders = new Set([
    "n/a",
    "na",
    "n.a.",
    "n.a",
    "na.",
    "not applicable",
    "not available",
    "none",
    "null",
    "nil",
    "tbd",
    "tba",
    "unknown",
    "?",
    "??",
    "---",
    "-",
    "--",
  ]);
  if (exactPlaceholders.has(lower)) return false;
  if (/^[—–−]+$/u.test(t)) return false;
  if (/^[\-\u2013\u2014\u2015\u2212]+$/u.test(t)) return false;
  const alnum = t.replace(/[\s\-\u2013\u2014\u2015\u2212._/\\|.,;:]+/gu, "");
  if (!alnum) return false;
  return true;
}

/**
 * Flag rows where the same normalized key appears more than once in the file.
 * First occurrence stays without this error; later rows reference earlier row numbers (1-based CSV order).
 */
export function flagCsvDuplicateKeys<T extends { _error?: string }>(
  rows: T[],
  getKey: (row: T) => string | null | undefined,
  fieldLabel: string
): void {
  const byKey = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const raw = getKey(rows[i]);
    if (!raw || !String(raw).trim()) continue;
    if (!isCsvDuplicateSignificantValue(raw)) continue;
    const norm = String(raw).trim();
    if (!byKey.has(norm)) byKey.set(norm, []);
    byKey.get(norm)!.push(i);
  }
  for (const indices of byKey.values()) {
    if (indices.length < 2) continue;
    for (let j = 1; j < indices.length; j++) {
      const i = indices[j];
      const earlier = indices.slice(0, j).map((idx) => idx + 1);
      appendPreviewRowError(
        rows[i],
        `Duplicate ${fieldLabel} in this file (same value as row ${earlier.join(", ")})`
      );
    }
  }
}

const CHUNK = 150;

async function valuesExistingInColumn(
  supabase: SupabaseClient,
  table: "assets" | "sim_cards",
  column: string,
  values: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(values.map((v) => v.trim()).filter((v) => isCsvDuplicateSignificantValue(v)))];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase.from(table).select(column).in(column, chunk);
    if (error) continue;
    for (const row of data ?? []) {
      if (!row || typeof row !== "object" || "error" in row) continue;
      const v = (row as Record<string, unknown>)[column];
      if (typeof v === "string" && v.trim()) out.add(v.trim());
    }
  }
  return out;
}

/** SIM numbers that already exist (exact match after trim). */
export async function fetchExistingSimNumbers(
  supabase: SupabaseClient,
  simNumbers: string[]
): Promise<Set<string>> {
  return valuesExistingInColumn(supabase, "sim_cards", "sim_number", simNumbers);
}

/** Asset field values already present (trimmed exact match). */
export async function fetchExistingAssetIdentifiers(
  supabase: SupabaseClient,
  field: "serial" | "asset_id" | "imei_1" | "imei_2",
  values: string[]
): Promise<Set<string>> {
  return valuesExistingInColumn(supabase, "assets", field, values);
}

/**
 * IMEI may appear in either imei_1 or imei_2 on any asset.
 */
export async function fetchExistingAssetImeis(
  supabase: SupabaseClient,
  imeis: string[]
): Promise<Set<string>> {
  const unique = [...new Set(imeis.map((v) => v.trim()).filter((v) => isCsvDuplicateSignificantValue(v)))];
  const found = new Set<string>();
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data: a } = await supabase.from("assets").select("imei_1").in("imei_1", chunk);
    const { data: b } = await supabase.from("assets").select("imei_2").in("imei_2", chunk);
    for (const row of a ?? []) {
      const v = row.imei_1;
      if (typeof v === "string" && v.trim()) found.add(v.trim());
    }
    for (const row of b ?? []) {
      const v = row.imei_2;
      if (typeof v === "string" && v.trim()) found.add(v.trim());
    }
  }
  return found;
}

/** All vehicle plates trimmed lowercased (for case-insensitive duplicate checks). */
export async function fetchVehiclePlatesLowerSet(supabase: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase.from("vehicles").select("plate_number").range(from, from + page - 1);
    if (error || !data?.length) break;
    for (const r of data) {
      const p = typeof r.plate_number === "string" ? r.plate_number.trim().toLowerCase() : "";
      if (p) out.add(p);
    }
    if (data.length < page) break;
    from += page;
  }
  return out;
}

export type EmployeeIdentitySets = {
  emailsLower: Set<string>;
  passports: Set<string>;
  iqamas: Set<string>;
};

export async function loadEmployeeIdentitySets(supabase: SupabaseClient): Promise<EmployeeIdentitySets> {
  const emailsLower = new Set<string>();
  const passports = new Set<string>();
  const iqamas = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("employees")
      .select("email, passport_number, iqama_number")
      .range(from, from + page - 1);
    if (error || !data?.length) break;
    for (const r of data) {
      const e = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
      if (e) emailsLower.add(e);
      const p = typeof r.passport_number === "string" ? r.passport_number.trim() : "";
      if (p && isCsvDuplicateSignificantValue(p)) passports.add(p);
      const q = typeof r.iqama_number === "string" ? r.iqama_number.trim() : "";
      if (q && isCsvDuplicateSignificantValue(q)) iqamas.add(q);
    }
    if (data.length < page) break;
    from += page;
  }
  return { emailsLower, passports, iqamas };
}

export async function simNumberExists(supabase: SupabaseClient, simNumber: string): Promise<boolean> {
  const t = simNumber.trim();
  if (!t) return false;
  const { data } = await supabase.from("sim_cards").select("id").eq("sim_number", t).maybeSingle();
  return !!data?.id;
}

export async function simNumberExistsOtherThan(
  supabase: SupabaseClient,
  simNumber: string,
  excludeId: string
): Promise<boolean> {
  const t = simNumber.trim();
  if (!t) return false;
  const { data } = await supabase.from("sim_cards").select("id").eq("sim_number", t).neq("id", excludeId).maybeSingle();
  return !!data?.id;
}

export async function vehiclePlateTaken(
  supabase: SupabaseClient,
  plate: string,
  excludeVehicleId?: string
): Promise<boolean> {
  const n = plate.trim().toLowerCase();
  if (!n) return false;
  const { data } = await supabase.from("vehicles").select("id, plate_number");
  const hit = data?.find((r) => (r.plate_number ?? "").trim().toLowerCase() === n);
  if (!hit?.id) return false;
  if (excludeVehicleId && hit.id === excludeVehicleId) return false;
  return true;
}

export type AssetIdentifierInput = {
  serial?: string | null;
  asset_id?: string | null;
  imei_1?: string | null;
  imei_2?: string | null;
};

/** Returns a user-facing message if any identifier conflicts with another asset, or null if OK. */
export async function assetIdentifierConflictMessage(
  supabase: SupabaseClient,
  input: AssetIdentifierInput,
  excludeAssetId?: string
): Promise<string | null> {
  const serialRaw = input.serial?.trim() || null;
  const assetIdRaw = input.asset_id?.trim() || null;
  const imei1Raw = input.imei_1?.trim() || null;
  const imei2Raw = input.imei_2?.trim() || null;
  const serial = serialRaw && isCsvDuplicateSignificantValue(serialRaw) ? serialRaw : null;
  const assetId = assetIdRaw && isCsvDuplicateSignificantValue(assetIdRaw) ? assetIdRaw : null;
  const imei1 = imei1Raw && isCsvDuplicateSignificantValue(imei1Raw) ? imei1Raw : null;
  const imei2 = imei2Raw && isCsvDuplicateSignificantValue(imei2Raw) ? imei2Raw : null;

  if (serial) {
    const { data } = await supabase.from("assets").select("id").eq("serial", serial).maybeSingle();
    if (data?.id && data.id !== excludeAssetId) return `Serial "${serial}" is already used by another asset.`;
  }
  if (assetId) {
    const { data } = await supabase.from("assets").select("id").eq("asset_id", assetId).maybeSingle();
    if (data?.id && data.id !== excludeAssetId) return `Asset ID "${assetId}" is already used by another asset.`;
  }
  for (const imei of [imei1, imei2]) {
    if (!imei) continue;
    const { data: r1 } = await supabase.from("assets").select("id").eq("imei_1", imei).maybeSingle();
    if (r1?.id && r1.id !== excludeAssetId) return `IMEI "${imei}" is already recorded on another asset.`;
    const { data: r2 } = await supabase.from("assets").select("id").eq("imei_2", imei).maybeSingle();
    if (r2?.id && r2.id !== excludeAssetId) return `IMEI "${imei}" is already recorded on another asset.`;
  }
  return null;
}

/**
 * Two rows (or same row twice in two columns) must not share the same IMEI in an asset import preview.
 */
export function flagCsvDuplicateImeisInAssetImport<
  T extends { _error?: string; _payload: { imei_1: string | null; imei_2: string | null } },
>(rows: T[]): void {
  const byImei = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const seenInRow = new Set<string>();
    const push = (raw: string | null) => {
      if (!raw || !String(raw).trim()) return;
      if (!isCsvDuplicateSignificantValue(raw)) return;
      const t = String(raw).trim();
      if (seenInRow.has(t)) return;
      seenInRow.add(t);
      if (!byImei.has(t)) byImei.set(t, []);
      byImei.get(t)!.push(i);
    };
    push(rows[i]._payload.imei_1);
    push(rows[i]._payload.imei_2);
  }
  for (const indices of byImei.values()) {
    if (indices.length < 2) continue;
    const uniqRows = [...new Set(indices)];
    if (uniqRows.length < 2) continue;
    for (let j = 1; j < uniqRows.length; j++) {
      const i = uniqRows[j];
      const earlier = uniqRows.slice(0, j).map((idx) => idx + 1);
      appendPreviewRowError(rows[i], `Duplicate IMEI in this file (same value as row ${earlier.join(", ")})`);
    }
  }
}

export async function employeeIdentityConflict(
  supabase: SupabaseClient,
  fields: { email: string; passport_number: string; iqama_number: string },
  excludeEmployeeId?: string
): Promise<string | null> {
  const email = fields.email.trim().toLowerCase();
  const passport = fields.passport_number.trim();
  const iqama = fields.iqama_number.trim();
  const passportSignificant = isCsvDuplicateSignificantValue(passport);
  const iqamaSignificant = isCsvDuplicateSignificantValue(iqama);

  let from = 0;
  const page = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("employees")
      .select("id, email, passport_number, iqama_number")
      .range(from, from + page - 1);
    if (error || !data?.length) break;
    for (const r of data) {
      if (excludeEmployeeId && r.id === excludeEmployeeId) continue;
      const re = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
      if (email && re === email) return "An employee with this email already exists.";
      const rp = typeof r.passport_number === "string" ? r.passport_number.trim() : "";
      if (passportSignificant && rp === passport) return "An employee with this passport number already exists.";
      const rq = typeof r.iqama_number === "string" ? r.iqama_number.trim() : "";
      if (iqamaSignificant && rq === iqama) return "An employee with this Iqama number already exists.";
    }
    if (data.length < page) break;
    from += page;
  }
  return null;
}
