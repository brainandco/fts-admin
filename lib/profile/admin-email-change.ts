import { createHash, randomBytes } from "crypto";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

export const EMAIL_CHANGE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmailChangeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateEmailChangeToken(): string {
  return randomBytes(32).toString("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

/** Returns user id if email is already used by another account (users_profile). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = normalizeEmail(email);
  const admin = createServerSupabaseAdmin();
  const { data } = await admin.from("users_profile").select("id").eq("email", normalized).maybeSingle();
  return data?.id ?? null;
}
