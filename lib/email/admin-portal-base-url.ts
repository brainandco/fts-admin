/**
 * Public origin of the admin app (no trailing slash). Used for all admin emails (invitation + credentials).
 *
 * Resolution order:
 * 1. ADMIN_PORTAL_PUBLIC_URL — optional override (e.g. match emails to a working host before custom DNS)
 * 2. NEXT_PUBLIC_APP_URL or ADMIN_PORTAL_URL
 * 3. On Vercel: VERCEL_URL (your *.vercel.app host — works even when admin.fts-ksa.com has no DNS yet)
 * 4. Fallback: https://admin.fts-ksa.com (requires DNS A/CNAME to your host; NXDOMAIN = not configured)
 */
export function getAdminPortalBaseUrl(): string {
  let raw = (process.env.ADMIN_PORTAL_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_PORTAL_URL || "")
    .trim()
    .replace(/\/$/, "");
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
