/**
 * Normalize CSV onboarding_date for employee import → YYYY-MM-DD for Postgres `date`.
 *
 * Supported:
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (year first; month/day 1–2 digits padded)
 * - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (day first)
 * - Ambiguous numeric (both parts ≤12, e.g. 03/02/2023): day-first (DD/MM), common outside US
 * - When second part >12: treated as US M/D/Y (e.g. 1/15/2023 → Jan 15)
 * - When first part >12: day-first (e.g. 15/1/2023 → 15 Jan)
 * - DD-MM-YY / … with 2-digit year (pivot: 00–49 → 2000–2049, 50–99 → 1950–1999)
 * - ISO datetime prefix: 2023-01-15T12:00:00Z → date part only
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function expandTwoDigitYear(yy: number): number {
  if (yy < 0 || yy > 99) return -1;
  return yy <= 49 ? 2000 + yy : 1900 + yy;
}

/** YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD */
function tryYearFirst(s: string): string | null {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isValidYmd(y, mo, d)) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

/**
 * DD-MM-YYYY or DD/MM/YYYY with disambiguation:
 * - a > 12 → DMY
 * - b > 12 → MDY (US)
 * - else → DMY (day first)
 */
function tryDayOrMonthFirstWithFourDigitYear(s: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = Number(m[3]);
  let day: number;
  let month: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  if (!isValidYmd(y, month, day)) return null;
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

/** Same rules with 2-digit year */
function tryDayOrMonthFirstWithTwoDigitYear(s: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/.exec(s);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const yy = Number(m[3]);
  const y = expandTwoDigitYear(yy);
  if (y < 1900) return null;
  let day: number;
  let month: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  if (!isValidYmd(y, month, day)) return null;
  return `${y}-${pad2(month)}-${pad2(day)}`;
}

/** Strip time / timezone from ISO datetime */
function tryIsoDateTimePrefix(s: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T\s]/i.exec(s);
  if (!m) return null;
  return tryYearFirst(m[1]);
}

export type NormalizeOnboardingDateResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/** Empty → null. Otherwise returns YYYY-MM-DD or error. */
export function normalizeOnboardingDate(raw: string): NormalizeOnboardingDateResult {
  let s = raw.trim();
  if (!s) return { ok: true, value: null };

  // Excel sometimes exports dates wrapped in quotes with spaces
  s = s.replace(/^["']|["']$/g, "").trim();

  // 2023-01-15T00:00:00 or 2023-01-15 00:00:00
  const isoPrefix = tryIsoDateTimePrefix(s);
  if (isoPrefix) return { ok: true, value: isoPrefix };

  const ymd = tryYearFirst(s);
  if (ymd) return { ok: true, value: ymd };

  const dmy4 = tryDayOrMonthFirstWithFourDigitYear(s);
  if (dmy4) return { ok: true, value: dmy4 };

  const dmy2 = tryDayOrMonthFirstWithTwoDigitYear(s);
  if (dmy2) return { ok: true, value: dmy2 };

  return {
    ok: false,
    message: `Unrecognized or invalid onboarding_date: ${raw}. Use YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, etc.`,
  };
}
