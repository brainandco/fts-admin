import { PutObjectCommand } from "@aws-sdk/client-s3";
import { normalizeRelativePathUnderEmployee } from "@/lib/employee-files/storage";
import { ppReportsKeyPrefixBase } from "@/lib/employee-files/pp-reports-storage";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import {
  getWasabiEmployeeFilesS3Client,
  getWasabiPpReportsBucket,
  isPpReportsBucketConfigured,
} from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

type Body = { relativePath?: string };

export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPpReportsBucketConfigured()) {
    return NextResponse.json({ message: "PP reports bucket is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const rel = normalizeRelativePathUnderEmployee(String(body.relativePath ?? ""));
  if (!rel) {
    return NextResponse.json({ message: "relativePath is required" }, { status: 400 });
  }

  const base = ppReportsKeyPrefixBase();
  const markerKey = `${base ? `${base}/` : ""}${rel}/.keep`;

  const s3 = getWasabiEmployeeFilesS3Client();
  const bucket = getWasabiPpReportsBucket()!;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: markerKey,
        Body: "",
      })
    );
    return NextResponse.json({ ok: true, created: rel });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create folder failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
