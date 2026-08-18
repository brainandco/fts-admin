import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/find-auth-user-id-by-email";
import { randomPassword } from "@/lib/email/send-employee-credentials";
import { getEmployeePortalBaseUrl } from "@/lib/email/employee-portal-base-url";
import { DRIVER_RIGGER_ROLE, driverPortalEmail, normalizeIqama } from "@/lib/employees/driver-iqama";

export type DriverIqamaLoginResult =
  | {
      ok: true;
      employeeId: string;
      email: string;
      iqama: string;
      fullName: string;
      portalUrl: string;
      /** Set when a new password was generated. Null if an existing Auth user was left unchanged. */
      password: string | null;
    }
  | { ok: false; message: string };

/**
 * Ensure an ACTIVE Driver/Rigger can log in with Iqama + password.
 * Does not email. Does not force password change. Does not touch other employees.
 */
export async function ensureDriverRiggerIqamaLogin(input: {
  employeeId: string;
  /** When true, always set a new random password and return it. */
  resetPassword: boolean;
}): Promise<DriverIqamaLoginResult> {
  const admin = createServerSupabaseAdmin();
  const { data: employee, error: empErr } = await admin
    .from("employees")
    .select("id, full_name, email, iqama_number, status")
    .eq("id", input.employeeId)
    .maybeSingle();
  if (empErr || !employee) return { ok: false, message: "Employee not found" };

  const { data: roles } = await admin.from("employee_roles").select("role").eq("employee_id", input.employeeId);
  if (!(roles ?? []).some((r) => r.role === DRIVER_RIGGER_ROLE)) {
    return { ok: false, message: "Iqama login is only for Driver/Rigger" };
  }

  const iqama = normalizeIqama(String(employee.iqama_number ?? ""));
  if (!iqama || iqama.length < 8) {
    return { ok: false, message: "Driver/Rigger needs a valid Iqama number for portal login" };
  }

  const email = driverPortalEmail(iqama, employee.email);
  const { data: clash } = await admin.from("employees").select("id").eq("email", email).neq("id", employee.id).limit(1);
  if ((clash ?? []).length > 0) {
    return { ok: false, message: `Login email ${email} is already used by another employee` };
  }

  const currentEmail = (employee.email ?? "").trim().toLowerCase();
  if (currentEmail !== email) {
    const { error: emailErr } = await admin.from("employees").update({ email }).eq("id", employee.id);
    if (emailErr) return { ok: false, message: emailErr.message };
  }

  let portalUserId = await findAuthUserIdByEmail(admin, email);
  const fullName = (employee.full_name ?? "").trim();
  const portalUrl = `${getEmployeePortalBaseUrl()}/login`;
  const mustCreate = !portalUserId;
  const shouldSetPassword = input.resetPassword || mustCreate;
  const password = shouldSetPassword ? randomPassword(12) : null;

  if (portalUserId) {
    const { data: profile } = await admin
      .from("users_profile")
      .select("is_super_user, employee_portal_only")
      .eq("id", portalUserId)
      .maybeSingle();
    if (profile?.is_super_user) {
      return { ok: false, message: "This email belongs to a Super User — password not changed" };
    }
    if (profile && profile.employee_portal_only === false) {
      return { ok: false, message: "This email is an admin login — password not changed" };
    }
    if (password) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(portalUserId, { password });
      if (pwErr) return { ok: false, message: pwErr.message };
    }
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: password!,
      email_confirm: true,
    });
    if (createErr) return { ok: false, message: createErr.message };
    portalUserId = created?.user?.id ?? null;
    if (!portalUserId) return { ok: false, message: "Auth user created without id" };
  }

  const { error: profileErr } = await admin.from("users_profile").upsert(
    {
      id: portalUserId,
      email,
      full_name: fullName || null,
      status: employee.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      employee_portal_only: true,
      must_change_password: false,
    },
    { onConflict: "id" }
  );
  if (profileErr) return { ok: false, message: profileErr.message };

  await admin.from("employees").update({ must_change_password: false }).eq("id", employee.id);

  return {
    ok: true,
    employeeId: employee.id,
    email,
    iqama,
    fullName,
    portalUrl,
    password,
  };
}
