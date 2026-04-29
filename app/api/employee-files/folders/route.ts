import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { buildEmployeeRootPrefix, normalizeRelativePathUnderEmployee } from "@/lib/employee-files/storage";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

type Body = { regionId?: string; employeeId?: string; relativePath?: string };

/** POST — create a folder marker under an employee’s storage path (admin). */
export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const regionId = String(body.regionId ?? "").trim();
  const employeeId = String(body.employeeId ?? "").trim();
  const relativePath = normalizeRelativePathUnderEmployee(String(body.relativePath ?? ""));

  if (!regionId || !employeeId) {
    return NextResponse.json({ message: "regionId and employeeId are required" }, { status: 400 });
  }
  if (!relativePath) {
    return NextResponse.json({ message: "relativePath is required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, region_id, status, full_name")
    .eq("id", employeeId)
    .maybeSingle();

  if (empErr || !emp || emp.status !== "ACTIVE") {
    return NextResponse.json({ message: "Employee not found or inactive" }, { status: 400 });
  }
  if (emp.region_id !== regionId) {
    return NextResponse.json({ message: "Employee is not in the selected region" }, { status: 400 });
  }

  const { data: folder, error: folderErr } = await supabase
    .from("employee_file_region_folders")
    .select("path_segment")
    .eq("region_id", regionId)
    .maybeSingle();

  if (folderErr || !folder) {
    return NextResponse.json({ message: "Region folder not found." }, { status: 400 });
  }

  const root = buildEmployeeRootPrefix(folder.path_segment, emp.full_name ?? null, emp.id);
  const markerKey = `${root}${relativePath}/.keep`;

  try {
    const s3 = getWasabiEmployeeFilesS3Client();
    const bucket = getWasabiEmployeeFilesBucket();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: markerKey,
        Body: "",
      })
    );
    return NextResponse.json({ ok: true, markerKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create folder failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
