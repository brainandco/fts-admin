import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

/** True when this email belongs to an employee record (any status). Uses service role when available. */
export async function emailHasEmployeeRecord(
  email: string,
  sessionClient?: SupabaseClient
): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;
  const client =
    process.env.SUPABASE_SERVICE_ROLE_KEY ? createServerSupabaseAdmin() : sessionClient;
  if (!client) return false;
  const { data } = await client.from("employees").select("id").eq("email", e).maybeSingle();
  return !!data;
}
