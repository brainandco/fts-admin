/** Canonical email for auth + employees table (matches Supabase Auth). */
export function normalizeEmployeeEmail(email: string): string {
  return email.trim().toLowerCase();
}
