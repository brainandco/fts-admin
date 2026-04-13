/**
 * Same-origin app paths only — blocks open redirects (e.g. //evil.com, https:).
 */
export function safeInternalReturnPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("://")) return null;
  return t;
}
