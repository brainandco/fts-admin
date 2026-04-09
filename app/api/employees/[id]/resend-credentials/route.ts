import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { randomPassword, sendEmployeeCredentials } from "@/lib/email/send-employee-credentials";

/**
 * POST /api/employees/[id]/resend-credentials
 * Generates a new temporary password, updates the auth user, and emails the credentials
 * to the employee. Use when the employee didn't receive the first email or lost their password.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await can("users.edit")) && !(await can("employees.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const supabase = await getDataClient();
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, email, full_name")
    .eq("id", employeeId)
    .single();

  if (empError || !employee) {
    return NextResponse.json({ message: "Employee not found" }, { status: 404 });
  }

  const email = (employee.email ?? "").trim();
  const fullName = (employee.full_name ?? "").trim();
  if (!email) {
    return NextResponse.json({ message: "Employee has no email" }, { status: 400 });
  }

  let credentialsSent = false;
  let credentialsError: string | undefined;
  const password = randomPassword(12);

  try {
    const admin = createServerSupabaseAdmin();
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      await admin.auth.admin.updateUserById(existingUser.id, { password });
    } else {
      const { error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        return NextResponse.json(
          { message: `Auth user could not be created: ${createErr.message}` },
          { status: 400 }
        );
      }
    }

    const sendResult = await sendEmployeeCredentials(email, fullName, password);
    credentialsSent = sendResult.sent;
    if (!sendResult.sent) credentialsError = sendResult.error ?? "Email could not be sent";
  } catch (e) {
    console.error("Resend credentials error:", e);
    credentialsError = e instanceof Error ? e.message : "Unknown error";
  }

  const body: Record<string, unknown> = { credentialsSent, credentialsError };
  if (!credentialsSent && password) body.temporaryPassword = password;
  return NextResponse.json(body);
}
