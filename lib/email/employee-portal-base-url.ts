/**
 * Public origin of the employee app (no trailing slash). Used for employee credential emails.
 *
 * Resolution order:
 * 1. EMPLOYEE_PORTAL_PUBLIC_URL — optional override (staging, previews, or temporary hosts)
 * 2. Production (NODE_ENV=production): always https://employee.fts-ksa.com so emails match the public
 *    domain even if EMPLOYEE_PORTAL_URL points at a Vercel default host for the app runtime.
 * 3. Development: EMPLOYEE_PORTAL_URL or NEXT_PUBLIC_EMPLOYEE_APP_URL, else http://localhost:3001
 */

const CANONICAL_EMPLOYEE_PORTAL = "https://employee.fts-ksa.com";

function withScheme(url: string): string {
  let raw = url.trim().replace(/\/$/, "");
  if (!raw) return raw;
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/$/, "");
}

export function getEmployeePortalBaseUrl(): string {
  const override = (process.env.EMPLOYEE_PORTAL_PUBLIC_URL || "").trim();
  if (override) {
    return withScheme(override);
  }

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_EMPLOYEE_PORTAL;
  }

  let raw = (process.env.EMPLOYEE_PORTAL_URL || process.env.NEXT_PUBLIC_EMPLOYEE_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (!raw) {
    raw = "http://localhost:3001";
  }
  return withScheme(raw);
}
