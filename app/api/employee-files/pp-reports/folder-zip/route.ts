import { PassThrough, Readable } from "node:stream";
import {
  appendSiteFolderObjectsToArchive,
  createZipArchiver,
} from "@/lib/employee-files/site-folder-zip";
import {
  getS3ForPpReportsZip,
  resolveAdminPpReportsFolderZip,
} from "@/lib/employee-files/pp-reports-folder-zip";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { isPpReportsBucketConfigured } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function safeZipFileBase(name: string): string {
  const t = name.replace(/[^\w.\-()+ @&$=!*,?:;]/g, "_").slice(0, 120);
  return t || "folder";
}

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

  const { s3, bucket } = getS3ForPpReportsZip();
  const pass = new PassThrough();
  const archive = createZipArchiver();
  archive.on("error", (err: Error) => {
    pass.destroy(err);
  });
  archive.pipe(pass);

  const { folder } = resolved;
  const base = safeZipFileBase(folder.zipRootFolderName.split("/").pop() ?? "folder");
  const disp = `attachment; filename="${base}.zip"; filename*=UTF-8''${encodeURIComponent(`${base}.zip`)}`;

  void (async () => {
    try {
      await appendSiteFolderObjectsToArchive(s3, bucket, folder.s3Prefix, folder.zipRootFolderName, archive);
      await archive.finalize();
    } catch (e) {
      try {
        archive.abort();
      } catch {
        /* ignore */
      }
      pass.destroy(e instanceof Error ? e : new Error("Zip failed"));
    }
  })();

  const webBody = Readable.toWeb(pass) as unknown as BodyInit;
  return new Response(webBody, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disp,
      "Cache-Control": "no-store",
    },
  });
}
