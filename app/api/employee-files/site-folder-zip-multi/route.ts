import { PassThrough, Readable } from "node:stream";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import {
  appendSiteFolderObjectsToArchive,
  createZipArchiver,
  getS3ForSiteZip,
  MAX_OBJECTS_IN_ZIP,
  MAX_OBJECTS_MULTI_ZIP_TOTAL,
  resolveMultiSiteFolderZipContexts,
} from "@/lib/employee-files/site-folder-zip";

export const runtime = "nodejs";

function safeZipFileBase(name: string): string {
  const t = name.replace(/[^\w.\-()+ @&$=!*,?:;]/g, "_").slice(0, 120);
  return t || "folders";
}

export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { regionId?: string; employeeId?: string; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const regionId = String(body.regionId ?? "").trim();
  const employeeId = String(body.employeeId ?? "").trim();
  const paths = Array.isArray(body.paths) ? body.paths.map((p) => String(p ?? "").trim()).filter(Boolean) : [];

  if (!regionId || !employeeId || paths.length === 0) {
    return new Response(JSON.stringify({ message: "regionId, employeeId, and a non-empty paths array are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolved = await resolveMultiSiteFolderZipContexts(regionId, employeeId, paths);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ message: resolved.message }), {
      status: resolved.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { s3, bucket } = getS3ForSiteZip();
  const pass = new PassThrough();
  const archive = createZipArchiver();
  archive.on("error", (err: Error) => {
    pass.destroy(err);
  });
  archive.pipe(pass);

  const multi = resolved.folders.length > 1;
  const base = safeZipFileBase(multi ? "employee-folders-bundle" : resolved.folders[0].zipRootFolderName.split("/").pop() ?? "folder");
  const disp = `attachment; filename="${base}.zip"; filename*=UTF-8''${encodeURIComponent(`${base}.zip`)}`;

  void (async () => {
    try {
      let budget = MAX_OBJECTS_MULTI_ZIP_TOTAL;
      for (const folder of resolved.folders) {
        if (budget <= 0) break;
        const take = Math.min(MAX_OBJECTS_IN_ZIP, budget);
        const { objectCount } = await appendSiteFolderObjectsToArchive(
          s3,
          bucket,
          folder.sitePrefix,
          folder.zipRootFolderName,
          archive,
          { maxObjects: take }
        );
        budget -= objectCount;
      }
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
