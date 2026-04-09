import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";
import { randomPassword, sendEmployeeCredentials } from "@/lib/email/send-employee-credentials";
import { normalizeEmployeeRolePayload } from "@/lib/employees/employee-role-options";
import { employeeIdentityConflict } from "@/lib/data-uniqueness";
export async function POST(req: Request) {
  if (!(await can("users.create")) && !(await can("employees.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const input = await req.json() as Record<string, unknown>;
  const full_name = typeof input.full_name === "string" ? input.full_name.trim() : "";
  const passport_number = typeof input.passport_number === "string" ? input.passport_number.trim() : "";
  const country = typeof input.country === "string" ? input.country.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const iqama_number = typeof input.iqama_number === "string" ? input.iqama_number.trim() : "";

  if (!full_name) return NextResponse.json({ message: "Full name is required" }, { status: 400 });
  if (!country) return NextResponse.json({ message: "Country is required" }, { status: 400 });
  if (!email) return NextResponse.json({ message: "Email is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ message: "Phone number is required" }, { status: 400 });
  if (!iqama_number) return NextResponse.json({ message: "Iqama number is required" }, { status: 400 });
  const roleNorm = normalizeEmployeeRolePayload({
    roles: input.roles,
    role_custom: input.role_custom,
  });
  if (!roleNorm.ok) return NextResponse.json({ message: roleNorm.message }, { status: 400 });

  const onboarding_date = typeof input.onboarding_date === "string" ? input.onboarding_date.trim() || null : null;
  if (!onboarding_date) return NextResponse.json({ message: "Onboarding date is required" }, { status: 400 });

  const accommodations =
    typeof input.accommodations === "string" ? input.accommodations.trim() || null : null;

  const supabase = await getDataClient();

  const identityClash = await employeeIdentityConflict(supabase, {
    email,
    passport_number,
    iqama_number,
  });
  if (identityClash) return NextResponse.json({ message: identityClash }, { status: 400 });

  const payload = {
    full_name,
    passport_number: passport_number || "",
    country,
    email,
    phone,
    iqama_number,
    region_id: null,
    project_id: null,
    project_name_other: null,
    onboarding_date,
    status: input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    accommodations,
  };
  const { data, error } = await supabase.from("employees").insert(payload).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  await supabase.from("employee_roles").insert({
    employee_id: data.id,
    role: roleNorm.role,
    role_custom: roleNorm.role_custom,
  });

  let credentialsSent = false;
  let credentialsError: string | undefined;
  const password = randomPassword(12);
  try {
    const admin = createServerSupabaseAdmin();
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) {
      const msg = authError.message.toLowerCase();
      const alreadyExists = msg.includes("already") || msg.includes("exists");
      if (!alreadyExists) {
        await auditLog({ actionType: "create", entityType: "employee", entityId: data.id, newValue: payload, description: "Employee created" });
        return NextResponse.json({ message: `Employee created but auth failed: ${authError.message}` }, { status: 400 });
      }
      // Auth user already exists: set a new password and send credentials so employee can log in
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingUser = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        await admin.auth.admin.updateUserById(existingUser.id, { password });
      }
    }
    // Send credentials email (same password used for auth)
    const sendResult = await sendEmployeeCredentials(email, full_name, password);
    credentialsSent = sendResult.sent;
    if (!sendResult.sent) credentialsError = sendResult.error ?? "Email could not be sent";
  } catch (e) {
    console.error("Employee credentials send error:", e);
    credentialsError = e instanceof Error ? e.message : "Unknown error";
  }

  await auditLog({ actionType: "create", entityType: "employee", entityId: data.id, newValue: payload, description: "Employee created" });
  return NextResponse.json({
    ...data,
    credentialsSent,
    credentialsError,
    ...(password && !credentialsSent ? { temporaryPassword: password } : {}),
  });
}
