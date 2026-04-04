/**
 * Public origin of the admin app (no trailing slash). Used for invite links and credential emails.
 * Prefer NEXT_PUBLIC_APP_URL or ADMIN_PORTAL_URL; in production, defaults to https://admin.fts-ksa.com if unset.
 */
export function getAdminPortalBaseUrl(): string {
  let raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_PORTAL_URL || "").trim().replace(/\/$/, "");
  if (!raw) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
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
