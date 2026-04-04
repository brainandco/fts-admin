/**
 * Public origin of the admin app (no trailing slash). Used for invite links and credential emails.
 *
 * Order: explicit env → Vercel deployment URL → production fallback.
 * NXDOMAIN on admin.fts-ksa.com means DNS for that host is missing at your registrar; set
 * NEXT_PUBLIC_APP_URL (or add A/CNAME for admin) until the subdomain resolves.
 */
export function getAdminPortalBaseUrl(): string {
  let raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_PORTAL_URL || "").trim().replace(/\/$/, "");
  if (!raw && process.env.VERCEL && process.env.VERCEL_URL?.trim()) {
    raw = process.env.VERCEL_URL.trim().replace(/\/$/, "");
  }
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      raw = "https://admin.fts-ksa.com";
    } else {
      raw = "http://localhost:3000";
    }
  }
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.replace(/\/$/, "");
}
