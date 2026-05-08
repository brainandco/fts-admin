import { normalizeRelativePathUnderEmployee } from "@/lib/employee-files/storage";
import { dedupeAncestorFolderPaths, MAX_FOLDERS_PER_MULTI_ZIP } from "@/lib/employee-files/site-folder-zip";
import { ppReportsKeyPrefixBase } from "@/lib/employee-files/pp-reports-storage";
import { getWasabiPpReportsBucket, getWasabiPpReportsS3Client } from "@/lib/wasabi/s3-client";

export type ResolvedPpReportsZipFolder = {
  s3Prefix: string;
  zipRootFolderName: string;
};

/** Full-bucket folder path (same rules as PP reports browse). */
export function resolveAdminPpReportsFolderZip(
  folderPathRaw: string
): { ok: true; folder: ResolvedPpReportsZipFolder } | { ok: false; status: number; message: string } {
  const normalized = normalizeRelativePathUnderEmployee(folderPathRaw.trim());
  if (!normalized) {
    return { ok: false, status: 400, message: "Invalid folder path" };
  }
  const base = ppReportsKeyPrefixBase();
  const s3Prefix = `${base ? `${base}/` : ""}${normalized}/`;
  return {
    ok: true,
    folder: {
      s3Prefix,
      zipRootFolderName: normalized.replace(/\\/g, "/"),
    },
  };
}

export function resolveMultiAdminPpReportsFolders(
  pathsRaw: string[]
): { ok: true; folders: ResolvedPpReportsZipFolder[] } | { ok: false; status: number; message: string } {
  const deduped = dedupeAncestorFolderPaths(pathsRaw);
  if (deduped.length === 0) {
    return { ok: false, status: 400, message: "No valid folder paths." };
  }
  if (deduped.length > MAX_FOLDERS_PER_MULTI_ZIP) {
    return {
      ok: false,
      status: 400,
      message: `At most ${MAX_FOLDERS_PER_MULTI_ZIP} folders per multi-download (after removing nested duplicates).`,
    };
  }
  const folders: ResolvedPpReportsZipFolder[] = [];
  for (const p of deduped) {
    const r = resolveAdminPpReportsFolderZip(p);
    if (!r.ok) return { ok: false, status: r.status, message: r.message };
    folders.push(r.folder);
  }
  return { ok: true, folders };
}

export function getS3ForPpReportsZip() {
  return {
    s3: getWasabiPpReportsS3Client(),
    bucket: getWasabiPpReportsBucket()!,
  };
}
