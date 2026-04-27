import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { buildRegionKeepObjectKey, slugifyRegionPathSegment } from "@/lib/employee-files/storage";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

/** GET — all region folders with region name. */
export async function GET() {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const supabase = await getDataClient();
  const { data: folderRows, error } = await supabase
    .from("employee_file_region_folders")
    .select("id, region_id, path_segment, created_at, created_by")
    .order("path_segment");
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  const regionIds = [...new Set((folderRows ?? []).map((f) => f.region_id))];
  const { data: regionList } = regionIds.length
    ? await supabase.from("regions").select("id, name, code").in("id", regionIds)
    : { data: [] };
  const byRegion = new Map((regionList ?? []).map((r) => [r.id, r] as const));
  const folders = (folderRows ?? []).map((f) => {
    const reg = byRegion.get(f.region_id);
    return {
      id: f.id,
      regionId: f.region_id,
      pathSegment: f.path_segment,
      createdAt: f.created_at,
      regionName: reg?.name ?? "—",
      regionCode: reg?.code ?? null,
    };
  });
  return NextResponse.json({ folders });
}

type PostBody = { regionId?: string; pathSegment?: string | null };

/** POST — create S3 "folder" for a region. */
export async function POST(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const user = await createServerSupabaseClient();
  const {
    data: { user: auth },
  } = await user.auth.getUser();
  if (!auth?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const regionId = String(body.regionId ?? "").trim();
  if (!regionId) {
    return NextResponse.json({ message: "regionId is required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: existing } = await supabase.from("employee_file_region_folders").select("id").eq("region_id", regionId).maybeSingle();
  if (existing) {
    return NextResponse.json({ message: "A folder already exists for this region" }, { status: 400 });
  }

  const { data: region, error: regErr } = await supabase
    .from("regions")
    .select("id, name, code")
    .eq("id", regionId)
    .single();
  if (regErr || !region) {
    return NextResponse.json({ message: "Region not found" }, { status: 400 });
  }

  let pathSegment: string;
  if (body.pathSegment != null && String(body.pathSegment).trim()) {
    pathSegment = slugifyRegionPathSegment(String(body.pathSegment).trim());
  } else {
    pathSegment = slugifyRegionPathSegment(`${region.code || ""}-${region.name}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pathSegment) || pathSegment.length < 2) {
    pathSegment = `region-${regionId.slice(0, 8)}`;
  }

  const { data: pathTaken } = await supabase
    .from("employee_file_region_folders")
    .select("id")
    .eq("path_segment", pathSegment)
    .maybeSingle();
  if (pathTaken) {
    return NextResponse.json(
      { message: "This path is already in use. Provide a custom path segment." },
      { status: 400 }
    );
  }

  const { data: ins, error: insErr } = await supabase
    .from("employee_file_region_folders")
    .insert({
      region_id: regionId,
      path_segment: pathSegment,
      created_by: auth.id,
    })
    .select("id, region_id, path_segment, created_at")
    .single();

  if (insErr || !ins) {
    return NextResponse.json({ message: insErr?.message ?? "Insert failed" }, { status: 400 });
  }

  const keepKey = buildRegionKeepObjectKey(pathSegment);
  const bucket = getWasabiEmployeeFilesBucket();
  const s3 = getWasabiEmployeeFilesS3Client();
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: keepKey,
        Body: new Uint8Array(0),
        ContentLength: 0,
      })
    );
  } catch (e) {
    await supabase.from("employee_file_region_folders").delete().eq("id", ins.id);
    const msg = e instanceof Error ? e.message : "Storage write failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }

  return NextResponse.json({
    folder: {
      id: ins.id,
      regionId: ins.region_id,
      pathSegment: ins.path_segment,
      createdAt: ins.created_at,
    },
  });
}
