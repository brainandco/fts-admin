import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeEmployeeEmail } from "@/lib/auth/employee-email";
import { randomPassword, sendEmployeeCredentials } from "@/lib/email/send-employee-credentials";

export type SendEmployeePortalCredentialsResult =
  | {
      ok: true;
      employeeId: string;
      email: string;
      fullName: string;
      credentialsSent: boolean;
      credentialsError?: string;
      temporaryPassword?: string;
    }
  | { ok: false; code: "not_found" | "no_email"; employeeId: string; message: string }
  | { ok: false; code: "auth_error"; employeeId: string; message: string };

/**
 * Same behavior as POST /api/employees/[id]/resend-credentials: new password, update/create auth user, email credentials.
 */
export async function sendEmployeePortalCredentials(employeeId: string): Promise<SendEmployeePortalCredentialsResult> {
  const supabase = await getDataClient();
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, email, full_name")
    .eq("id", employeeId)
    .single();

  if (empError || !employee) {
    return { ok: false, code: "not_found", employeeId, message: "Employee not found" };
  }

  const rawEmail = (employee.email ?? "").trim();
  const fullName = (employee.full_name ?? "").trim();
  if (!rawEmail) {
    return { ok: false, code: "no_email", employeeId, message: "Employee has no email" };
  }
  const email = normalizeEmployeeEmail(rawEmail);

  const password = randomPassword(12);

  try {
    const admin = createServerSupabaseAdmin();
    if (rawEmail !== email) {
      await admin.from("employees").update({ email }).eq("id", employeeId);
    }
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = list?.users?.find((u) => u.email?.toLowerCase() === email);

    let portalUserId: string | null = null;
    if (existingUser) {
      portalUserId = existingUser.id;
      await admin.auth.admin.updateUserById(existingUser.id, { password });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        return {
          ok: false,
          code: "auth_error",
          employeeId,
          message: `Auth user could not be created: ${createErr.message}`,
        };
      }
      portalUserId = created?.user?.id ?? null;
    }
    if (portalUserId) {
      await admin.from("users_profile").upsert(
        {
          id: portalUserId,
          email,
          full_name: fullName || null,
          status: "ACTIVE",
          employee_portal_only: true,
          must_change_password: true,
        },
        { onConflict: "id" }
      );
    }

    await admin.from("employees").update({ must_change_password: true }).eq("id", employeeId);

    const sendResult = await sendEmployeeCredentials(email, fullName, password);
    const credentialsSent = sendResult.sent;
    const credentialsError = sendResult.sent ? undefined : sendResult.error ?? "Email could not be sent";

    return {
      ok: true,
      employeeId,
      email,
      fullName,
      credentialsSent,
      ...(credentialsError ? { credentialsError } : {}),
      ...(!credentialsSent && password ? { temporaryPassword: password } : {}),
    };
  } catch (e) {
    console.error("sendEmployeePortalCredentials error:", e);
    return {
      ok: false,
      code: "auth_error",
      employeeId,
      message: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
