/**
 * Canonical admin portal URL for emails (login / bookmark). Defaults to production host.
 * Override with ADMIN_PORTAL_PUBLIC_URL if needed.
 */
export function getAdminPortalLoginPageUrl(): string {
  const raw = (process.env.ADMIN_PORTAL_PUBLIC_URL || "https://admin.fts-ksa.com").trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(raw)) {
    return `https://${raw}`.replace(/\/$/, "");
  }
  return raw;
}
