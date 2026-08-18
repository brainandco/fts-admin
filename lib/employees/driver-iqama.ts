export const DRIVER_RIGGER_ROLE = "Driver/Rigger";

export function normalizeIqama(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isUsableLoginEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || e === "n/a" || e === "na" || e === "-" || e === "none" || e === "null") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function syntheticDriverEmail(iqama: string): string {
  return `${normalizeIqama(iqama)}@driver.fts-ksa.com`;
}

export function driverPortalEmail(iqama: string, existingEmail: string | null | undefined): string {
  if (isUsableLoginEmail(existingEmail)) return (existingEmail ?? "").trim().toLowerCase();
  return syntheticDriverEmail(iqama);
}
