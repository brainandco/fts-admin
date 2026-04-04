/** Max length after normalization (uppercase trim). */
export const TEAM_CODE_MAX_LEN = 32;

/**
 * Trim and uppercase for storage. Empty string becomes "" (caller treats as missing).
 */
export function normalizeTeamCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Allowed: letters, digits, underscore, hyphen; 2–32 chars after normalization.
 */
export function isValidTeamCodeFormat(code: string): boolean {
  if (code.length < 2 || code.length > TEAM_CODE_MAX_LEN) return false;
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(code);
}
