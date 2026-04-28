import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

/** DELETE — admin removes one file (metadata + object). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ message: "id required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: row, error } = await supabase
    .from("employee_personal_files")
    .select("id, storage_key")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  const bucket = getWasabiEmployeeFilesBucket();
  const s3 = getWasabiEmployeeFilesS3Client();
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: row.storage_key }));
  } catch {
    // continue to remove DB row
  }
  const { error: del } = await supabase.from("employee_personal_files").delete().eq("id", id);
  if (del) {
    return NextResponse.json({ message: del.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
