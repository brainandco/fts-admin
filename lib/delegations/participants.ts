import type { SupabaseClient } from "@supabase/supabase-js";

/** Lowercased employee emails — users whose email appears here are not portal admins for delegation. */
export async function getEmployeeEmailSet(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.from("employees").select("email");
  return new Set((data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean));
}

export function isPortalAdminByEmail(email: string | null | undefined, employeeEmails: Set<string>): boolean {
  const e = (email ?? "").toLowerCase().trim();
  if (!e) return false;
  return !employeeEmails.has(e);
}

export function validateDelegationParticipants(input: {
  delegatorEmail: string | null | undefined;
  delegatorIsSuper: boolean;
  delegateeEmail: string | null | undefined;
  delegateeIsSuper: boolean;
  employeeEmails: Set<string>;
}): { ok: true } | { ok: false; message: string; status: number } {
  const { delegatorEmail, delegatorIsSuper, delegateeEmail, delegateeIsSuper, employeeEmails } = input;

  if (!isPortalAdminByEmail(delegatorEmail, employeeEmails)) {
    return { ok: false, message: "Only admin users can create delegations", status: 403 };
  }
  if (!isPortalAdminByEmail(delegateeEmail, employeeEmails)) {
    return { ok: false, message: "Delegation is only allowed between admin users", status: 400 };
  }
  if (!delegatorIsSuper && delegateeIsSuper) {
    return {
      ok: false,
      message: "Admins cannot delegate to a Super User. Super Users can delegate to other admins and Super Users.",
      status: 400,
    };
  }
  return { ok: true };
}
