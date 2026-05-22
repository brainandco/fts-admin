import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmployeeEmail } from "@/lib/auth/employee-email";

/** True when this email belongs to an employee record (any status). Uses service role when available. */
export async function emailHasEmployeeRecord(
  email: string,
  sessionClient?: SupabaseClient
): Promise<boolean> {
  const normalized = normalizeEmployeeEmail(email);
  if (!normalized) return false;
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServerSupabaseAdmin() : sessionClient;
  if (!client) return false;

  const { data: exact } = await client.from("employees").select("id").eq("email", normalized).maybeSingle();
  if (exact) return true;

  const raw = email.trim();
  const { data: rows } = await client.from("employees").select("id, email").ilike("email", raw).limit(10);
  return (rows ?? []).some((r) => normalizeEmployeeEmail(String(r.email ?? "")) === normalized);
}
