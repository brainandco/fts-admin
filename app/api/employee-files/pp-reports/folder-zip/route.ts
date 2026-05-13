import {
  buildPpReportsZipStreamingResponse,
  resolveAdminPpReportsFolderZip,
} from "@/lib/employee-files/pp-reports-folder-zip";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { isPpReportsBucketConfigured } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET ?path= — zip one folder in the PP final-reports bucket (admin employee-files permission). */
export async function GET(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPpReportsBucketConfigured()) {
    return NextResponse.json({ message: "PP reports bucket not configured." }, { status: 503 });
  }

  const rawPath = new URL(req.url).searchParams.get("path")?.trim() ?? "";
  const resolved = resolveAdminPpReportsFolderZip(rawPath);
  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: resolved.status });
  }

  return buildPpReportsZipStreamingResponse(resolved.folder);
}
