import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isKeyUnderPpReportsPrefix } from "@/lib/employee-files/pp-reports-storage";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { getWasabiPpReportsBucket, getWasabiPpReportsS3Client, isPpReportsBucketConfigured } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

const EXPIRES = 300;

export async function GET(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPpReportsBucketConfigured()) {
    return NextResponse.json({ message: "PP reports bucket not configured." }, { status: 503 });
  }

  const key = new URL(req.url).searchParams.get("key")?.trim() ?? "";
  if (!key || !isKeyUnderPpReportsPrefix(key)) {
    return NextResponse.json({ message: "Invalid key" }, { status: 400 });
  }

  const fileName = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
  const s3 = getWasabiPpReportsS3Client();
  const bucket = getWasabiPpReportsBucket()!;
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: EXPIRES });
  return NextResponse.json({ downloadUrl, expiresIn: EXPIRES });
}
