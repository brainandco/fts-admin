import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { sendEmployeePortalCredentials } from "@/lib/employees/send-employee-portal-credentials";

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
  const result = await sendEmployeePortalCredentials(employeeId);

  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ message: result.message }, { status: 404 });
    }
    if (result.code === "no_email") {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  const body: Record<string, unknown> = {
    credentialsSent: result.credentialsSent,
  };
  if (result.credentialsError) body.credentialsError = result.credentialsError;
  if (!result.credentialsSent && result.temporaryPassword) {
    body.temporaryPassword = result.temporaryPassword;
  }
  return NextResponse.json(body);
}
