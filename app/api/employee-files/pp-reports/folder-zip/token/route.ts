import { resolveAdminPpReportsFolderZip } from "@/lib/employee-files/pp-reports-folder-zip";
import {
  mintPpReportsZipToken,
  ppReportsZipLinkSecretConfigured,
} from "@/lib/employee-files/pp-reports-zip-token";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { NextResponse } from "next/server";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Body = { path?: string; ttlMs?: number };

export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!ppReportsZipLinkSecretConfigured()) {
    return NextResponse.json(
      {
        message:
          "Copy-download-link is not configured. Set PP_REPORTS_ZIP_LINK_SECRET (min 16 characters), or reuse EMPLOYEE_FILES_SITE_ZIP_LINK_SECRET on the server.",
      },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const rawPath = String(body.path ?? "").trim();
  const resolved = resolveAdminPpReportsFolderZip(rawPath);
  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: resolved.status });
  }

  const ttl =
    typeof body.ttlMs === "number" && body.ttlMs > 0 && body.ttlMs <= 30 * 24 * 60 * 60 * 1000
      ? body.ttlMs
      : DEFAULT_TTL_MS;
  const exp = Date.now() + ttl;

  const token = mintPpReportsZipToken({
    v: 1,
    scope: "bucket",
    path: resolved.folder.zipRootFolderName,
    exp,
  });
  if (!token) {
    return NextResponse.json({ message: "Could not mint link" }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const publicUrl = `${origin}/api/employee-files/pp-reports/folder-zip/public?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    url: publicUrl,
    expiresAt: new Date(exp).toISOString(),
  });
}
