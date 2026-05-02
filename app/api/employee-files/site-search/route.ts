import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { buildEmployeeRootPrefix } from "@/lib/employee-files/storage";
import { listAllObjectKeysUnderPrefix } from "@/lib/employee-files/s3-browse";
import { matchSiteFolderPaths, stripEmployeeRootFromKey } from "@/lib/employee-files/site-folder-search";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

const MAX_KEYS_PER_EMPLOYEE = 12_000;
const MAX_RESULTS = 250;

type SiteSearchHit = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  siteFolderName: string;
  pathUnderEmployee: string;
  parentPathBeforeSite: string;
  fileCountInSubtree: number;
};

export async function GET(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const regionId = String(url.searchParams.get("regionId") ?? "").trim();
  const q = String(url.searchParams.get("q") ?? "").trim();

  if (!regionId) {
    return NextResponse.json({ message: "regionId is required" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ message: "Search query must be at least 2 characters." }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: regionFolder, error: rfErr } = await supabase
    .from("employee_file_region_folders")
    .select("path_segment")
    .eq("region_id", regionId)
    .maybeSingle();

  if (rfErr || !regionFolder) {
    return NextResponse.json({ message: "Region folder not found for this region." }, { status: 400 });
  }

  const regionSeg = regionFolder.path_segment as string;

  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, email")
    .eq("region_id", regionId)
    .eq("status", "ACTIVE")
    .order("full_name");

  if (empErr) {
    return NextResponse.json({ message: empErr.message }, { status: 400 });
  }

  const s3 = getWasabiEmployeeFilesS3Client();
  const bucket = getWasabiEmployeeFilesBucket();

  const hits: SiteSearchHit[] = [];
  let globalTruncated = false;

  for (const emp of employees ?? []) {
    if (hits.length >= MAX_RESULTS) break;
    const root = buildEmployeeRootPrefix(regionSeg, emp.full_name ?? null, emp.id);
    let listRes: { keys: string[]; truncated: boolean };
    try {
      listRes = await listAllObjectKeysUnderPrefix(s3, bucket, root, MAX_KEYS_PER_EMPLOYEE);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "List failed";
      return NextResponse.json({ message: msg }, { status: 500 });
    }
    if (listRes.truncated) globalTruncated = true;

    const relatives: string[] = [];
    for (const key of listRes.keys) {
      const rel = stripEmployeeRootFromKey(key, root);
      if (rel) relatives.push(rel);
    }

    const matches = matchSiteFolderPaths(relatives, q);
    for (const [folderPath, { siteSegment }] of matches) {
      if (hits.length >= MAX_RESULTS) break;
      const parts = folderPath.split("/").filter(Boolean);
      const parentPathBeforeSite = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      const fileCountInSubtree = relatives.filter((r) => r === folderPath || r.startsWith(`${folderPath}/`)).length;
      hits.push({
        employeeId: emp.id,
        employeeName: emp.full_name ?? "—",
        employeeEmail: emp.email,
        siteFolderName: siteSegment,
        pathUnderEmployee: folderPath,
        parentPathBeforeSite,
        fileCountInSubtree,
      });
    }
  }

  hits.sort((a, b) => {
    const c = a.employeeName.localeCompare(b.employeeName);
    if (c !== 0) return c;
    return a.pathUnderEmployee.localeCompare(b.pathUnderEmployee);
  });

  return NextResponse.json({
    query: q,
    results: hits,
    truncated: globalTruncated || hits.length >= MAX_RESULTS,
    maxResults: MAX_RESULTS,
  });
}
