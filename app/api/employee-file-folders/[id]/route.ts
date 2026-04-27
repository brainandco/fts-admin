import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesKeyPrefix, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { deleteAllS3WithPrefix } from "@/lib/employee-files/delete-s3-prefix";
import { NextResponse } from "next/server";

/**
 * DELETE — remove region folder: all S3 objects under the prefix, all file rows, then the folder row.
 * Destructive: affects every employee who uploaded in this region.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id: folderId } = await ctx.params;
  if (!folderId) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: folder, error: folderErr } = await supabase
    .from("employee_file_region_folders")
    .select("id, path_segment, region_id")
    .eq("id", folderId)
    .maybeSingle();
  if (folderErr || !folder) {
    return NextResponse.json({ message: "Folder not found" }, { status: 404 });
  }

  const keyRoot = getWasabiEmployeeFilesKeyPrefix();
  const s3Prefix = `${keyRoot}/${folder.path_segment}`;
  const s3 = getWasabiEmployeeFilesS3Client();
  const bucket = getWasabiEmployeeFilesBucket();
  try {
    await deleteAllS3WithPrefix(s3, bucket, s3Prefix);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage delete failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }

  const { error: delFiles } = await supabase.from("employee_personal_files").delete().eq("folder_id", folderId);
  if (delFiles) {
    return NextResponse.json({ message: delFiles.message }, { status: 400 });
  }

  const { error: delFolder } = await supabase.from("employee_file_region_folders").delete().eq("id", folderId);
  if (delFolder) {
    return NextResponse.json({ message: delFolder.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, deletedFolderId: folderId });
}
