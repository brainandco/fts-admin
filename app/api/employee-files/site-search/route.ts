import type { S3Client } from "@aws-sdk/client-s3";
import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import {
  buildEmployeeRootPrefix,
  buildRegionFilesPrefix,
  employeeNameFolderSlug,
} from "@/lib/employee-files/storage";
import { listAllObjectKeysUnderPrefix, listRelativeFolderPathsBfs } from "@/lib/employee-files/s3-browse";
import {
  employeeIdentityMatchesQuery,
  escapeIlikePattern,
  matchSiteFolderPaths,
  splitKeyUnderRegionPrefix,
  stripEmployeeRootFromKey,
} from "@/lib/employee-files/site-folder-search";
import { getWasabiEmployeeFilesBucket, getWasabiEmployeeFilesS3Client } from "@/lib/wasabi/s3-client";
import { NextResponse } from "next/server";

const MAX_KEYS_PER_EMPLOYEE = 12_000;
const MAX_FOLDERS_BFS_PER_EMPLOYEE = 8_000;
const MAX_RESULTS = 250;
/** Parallel S3 scans — only used for mode=deep. */
const EMPLOYEE_SITE_SEARCH_CONCURRENCY = 6;
/** Cap DB key scan so region-wide ILIKE stays bounded. */
const MAX_DB_KEYS = 12_000;
const DB_PAGE = 1_000;

type SiteSearchHit = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  siteFolderName: string;
  pathUnderEmployee: string;
  parentPathBeforeSite: string;
  fileCountInSubtree: number;
};

type EmpRow = { id: string; full_name: string | null; email: string | null; status?: string | null };

function hitsFromRelativeKeys(
  emp: EmpRow,
  relatives: string[],
  q: string
): SiteSearchHit[] {
  const matches = matchSiteFolderPaths(relatives, q);
  const hits: SiteSearchHit[] = [];
  for (const [folderPath, { siteSegment }] of matches) {
    const parts = folderPath.split("/").filter(Boolean);
    const parentPathBeforeSite = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const fpSlash = `${folderPath}/`;
    let fileCountInSubtree = 0;
    for (const r of relatives) {
      if (r === folderPath || r.startsWith(fpSlash)) fileCountInSubtree++;
    }
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
  return hits;
}

async function siteSearchHitsForEmployeeS3(
  emp: EmpRow,
  regionSeg: string,
  s3: S3Client,
  bucket: string,
  q: string
): Promise<{ hits: SiteSearchHit[]; truncated: boolean }> {
  const root = buildEmployeeRootPrefix(regionSeg, emp.full_name ?? null, emp.id);
  const [listRes, bfsRes] = await Promise.all([
    listAllObjectKeysUnderPrefix(s3, bucket, root, MAX_KEYS_PER_EMPLOYEE),
    listRelativeFolderPathsBfs(s3, bucket, root, MAX_FOLDERS_BFS_PER_EMPLOYEE),
  ]);
  const truncated = listRes.truncated || bfsRes.truncated;

  const relatives: string[] = [];
  for (const key of listRes.keys) {
    const rel = stripEmployeeRootFromKey(key, root);
    if (rel) relatives.push(rel);
  }

  const matchesFromKeys = matchSiteFolderPaths(relatives, q);
  const matchesFromFolders = matchSiteFolderPaths(bfsRes.relativePaths, q);
  const matches = new Map(matchesFromKeys);
  for (const [folderPath, meta] of matchesFromFolders) {
    if (!matches.has(folderPath)) matches.set(folderPath, meta);
  }

  const hits: SiteSearchHit[] = [];
  for (const [folderPath, { siteSegment }] of matches) {
    const parts = folderPath.split("/").filter(Boolean);
    const parentPathBeforeSite = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    const fpSlash = `${folderPath}/`;
    let fileCountInSubtree = 0;
    for (const r of relatives) {
      if (r === folderPath || r.startsWith(fpSlash)) fileCountInSubtree++;
    }
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
  return { hits, truncated };
}

function employeeRootHit(emp: EmpRow, relatives: string[], slug: string): SiteSearchHit {
  return {
    employeeId: emp.id,
    employeeName: emp.full_name ?? "—",
    employeeEmail: emp.email,
    siteFolderName: slug || "Employee folder",
    pathUnderEmployee: "",
    parentPathBeforeSite: "",
    fileCountInSubtree: relatives.length,
  };
}

/** Fast path: search indexed upload metadata (includes inactive employees / old uploads). */
async function searchViaDatabase(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  regionId: string,
  regionSeg: string,
  q: string
): Promise<{ hits: SiteSearchHit[]; truncated: boolean; scannedKeys: number }> {
  const regionPrefix = buildRegionFilesPrefix(regionSeg);
  const pattern = `%${escapeIlikePattern(q)}%`;

  const fileRows: { employee_id: string; storage_key: string }[] = [];
  let truncated = false;

  for (let from = 0; from < MAX_DB_KEYS; from += DB_PAGE) {
    const to = Math.min(from + DB_PAGE - 1, MAX_DB_KEYS - 1);
    const { data, error } = await supabase
      .from("employee_personal_files")
      .select("employee_id, storage_key")
      .eq("region_id", regionId)
      .in("upload_status", ["active", "pending"])
      .ilike("storage_key", pattern)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    fileRows.push(...batch);
    if (batch.length < DB_PAGE) break;
    if (from + batch.length >= MAX_DB_KEYS) {
      truncated = true;
      break;
    }
  }

  const relativesByEmp = new Map<string, string[]>();
  const slugByEmp = new Map<string, string>();
  for (const row of fileRows) {
    const split = splitKeyUnderRegionPrefix(row.storage_key, regionPrefix);
    if (!split) continue;
    const list = relativesByEmp.get(row.employee_id) ?? [];
    list.push(split.relativePath);
    relativesByEmp.set(row.employee_id, list);
    if (!slugByEmp.has(row.employee_id)) slugByEmp.set(row.employee_id, split.employeeFolderSlug);
  }

  // Also match employees by name / email in this region (query may not appear in storage_key).
  const { data: nameMatchedEmps, error: nameErr } = await supabase
    .from("employees")
    .select("id, full_name, email, status")
    .eq("region_id", regionId)
    .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
    .limit(100);
  if (nameErr) throw new Error(nameErr.message);

  const empMap = new Map<string, EmpRow>();
  for (const e of nameMatchedEmps ?? []) {
    empMap.set(e.id, e);
    if (!relativesByEmp.has(e.id)) relativesByEmp.set(e.id, []);
  }

  const empIds = [...relativesByEmp.keys()];
  for (let i = 0; i < empIds.length; i += 100) {
    const missing = empIds.slice(i, i + 100).filter((id) => !empMap.has(id));
    if (missing.length === 0) continue;
    const { data: emps, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name, email, status")
      .in("id", missing);
    if (empErr) throw new Error(empErr.message);
    for (const e of emps ?? []) empMap.set(e.id, e);
  }

  // For name-matched employees with no keys from ILIKE, load a sample of their files for site matching.
  for (const e of nameMatchedEmps ?? []) {
    if ((relativesByEmp.get(e.id)?.length ?? 0) > 0) continue;
    const { data: sample, error: sampleErr } = await supabase
      .from("employee_personal_files")
      .select("storage_key")
      .eq("region_id", regionId)
      .eq("employee_id", e.id)
      .in("upload_status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (sampleErr) throw new Error(sampleErr.message);
    const list: string[] = [];
    for (const row of sample ?? []) {
      const split = splitKeyUnderRegionPrefix(row.storage_key, regionPrefix);
      if (!split) continue;
      list.push(split.relativePath);
      if (!slugByEmp.has(e.id)) slugByEmp.set(e.id, split.employeeFolderSlug);
    }
    relativesByEmp.set(e.id, list);
  }

  const hits: SiteSearchHit[] = [];
  for (const [empId, relatives] of relativesByEmp) {
    const emp = empMap.get(empId) ?? {
      id: empId,
      full_name: "Unknown employee",
      email: null,
      status: null,
    };
    const slug = slugByEmp.get(empId) ?? employeeNameFolderSlug(emp.full_name, emp.id);
    const siteHits = hitsFromRelativeKeys(emp, relatives, q);
    const identityMatch = employeeIdentityMatchesQuery(emp, slug, q);

    if (siteHits.length > 0) {
      for (const h of siteHits) {
        if (hits.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
        hits.push(h);
      }
    } else if (identityMatch) {
      // e.g. query "50341b36" matches employee folder slug but not a site segment
      if (hits.length >= MAX_RESULTS) {
        truncated = true;
      } else {
        hits.push(employeeRootHit(emp, relatives, slug));
      }
    }

    if (hits.length >= MAX_RESULTS) {
      truncated = true;
      break;
    }
  }

  return { hits, truncated, scannedKeys: fileRows.length };
}

/**
 * Slow path: full Wasabi walk (empty folders + S3-only legacy).
 * Includes inactive employees still assigned to the region.
 * (Moved-away employees' uploaded files are covered by the fast DB path.)
 */
async function searchViaWasabiDeep(
  supabase: Awaited<ReturnType<typeof getDataClient>>,
  regionId: string,
  regionSeg: string,
  q: string
): Promise<{ hits: SiteSearchHit[]; truncated: boolean }> {
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, email, status")
    .eq("region_id", regionId)
    .order("full_name");
  if (empErr) throw new Error(empErr.message);

  const empList: EmpRow[] = employees ?? [];
  const s3 = getWasabiEmployeeFilesS3Client();
  const bucket = getWasabiEmployeeFilesBucket();
  const hits: SiteSearchHit[] = [];
  let globalTruncated = false;

  for (let i = 0; i < empList.length && hits.length < MAX_RESULTS; i += EMPLOYEE_SITE_SEARCH_CONCURRENCY) {
    const batch = empList.slice(i, i + EMPLOYEE_SITE_SEARCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((emp) => siteSearchHitsForEmployeeS3(emp, regionSeg, s3, bucket, q))
    );
    for (const br of batchResults) {
      if (br.truncated) globalTruncated = true;
      for (const h of br.hits) {
        if (hits.length >= MAX_RESULTS) {
          globalTruncated = true;
          break;
        }
        hits.push(h);
      }
    }
  }

  return { hits, truncated: globalTruncated || hits.length >= MAX_RESULTS };
}

export async function GET(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const regionId = String(url.searchParams.get("regionId") ?? "").trim();
  const q = String(url.searchParams.get("q") ?? "").trim();
  const modeRaw = String(url.searchParams.get("mode") ?? "fast").trim().toLowerCase();
  const mode = modeRaw === "deep" ? "deep" : "fast";

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

  try {
    if (mode === "deep") {
      const { hits, truncated } = await searchViaWasabiDeep(supabase, regionId, regionSeg, q);
      hits.sort((a, b) => {
        const c = a.employeeName.localeCompare(b.employeeName);
        if (c !== 0) return c;
        return a.pathUnderEmployee.localeCompare(b.pathUnderEmployee);
      });
      return NextResponse.json({
        query: q,
        mode: "deep",
        results: hits,
        truncated,
        maxResults: MAX_RESULTS,
      });
    }

    const { hits, truncated, scannedKeys } = await searchViaDatabase(supabase, regionId, regionSeg, q);
    hits.sort((a, b) => {
      const c = a.employeeName.localeCompare(b.employeeName);
      if (c !== 0) return c;
      return a.pathUnderEmployee.localeCompare(b.pathUnderEmployee);
    });
    return NextResponse.json({
      query: q,
      mode: "fast",
      results: hits,
      truncated,
      scannedKeys,
      maxResults: MAX_RESULTS,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
