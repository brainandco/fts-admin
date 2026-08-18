import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/rbac/permissions";
import { provisionDriverRiggerLogins } from "@/lib/employees/provision-driver-rigger-logins";

/**
 * Super User only. Resets passwords for ALL active Driver/Riggers and returns an Excel sheet.
 * Keep the file offline. Re-running this invalidates the previous sheet.
 */
export async function POST() {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.is_super_user) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await provisionDriverRiggerLogins();
    const filename = `driver-rigger-logins-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(result.workbook), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Provision-Ok": String(result.okCount),
        "X-Provision-Errors": String(result.errorCount),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}
