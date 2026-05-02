import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { resolveSiteFolderZipContext } from "@/lib/employee-files/site-folder-zip";
import { mintSiteZipToken, siteZipLinkSecretConfigured } from "@/lib/employee-files/site-zip-token";
import { NextResponse } from "next/server";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Body = { regionId?: string; employeeId?: string; sitePath?: string; ttlMs?: number };

export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!siteZipLinkSecretConfigured()) {
    return NextResponse.json(
      {
        message:
          "Copy-download-link is not configured. Set EMPLOYEE_FILES_SITE_ZIP_LINK_SECRET (min 16 characters) on the server.",
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

  const regionId = String(body.regionId ?? "").trim();
  const employeeId = String(body.employeeId ?? "").trim();
  const sitePath = String(body.sitePath ?? "").trim();
  if (!regionId || !employeeId || !sitePath) {
    return NextResponse.json({ message: "regionId, employeeId, and sitePath are required" }, { status: 400 });
  }

  const resolved = await resolveSiteFolderZipContext(regionId, employeeId, sitePath);
  if (!resolved.ok) {
    return NextResponse.json({ message: resolved.message }, { status: resolved.status });
  }

  const ttl = typeof body.ttlMs === "number" && body.ttlMs > 0 && body.ttlMs <= 30 * 24 * 60 * 60 * 1000 ? body.ttlMs : DEFAULT_TTL_MS;
  const exp = Date.now() + ttl;

  const token = mintSiteZipToken({
    v: 1,
    rid: regionId,
    eid: employeeId,
    path: resolved.normalizedSitePath,
    exp,
  });
  if (!token) {
    return NextResponse.json({ message: "Could not mint link" }, { status: 503 });
  }

  const self = new URL(req.url);
  const origin = self.origin;
  const publicUrl = `${origin}/api/employee-files/site-folder-zip/public?t=${encodeURIComponent(token)}`;

  return NextResponse.json({
    url: publicUrl,
    expiresAt: new Date(exp).toISOString(),
  });
}
