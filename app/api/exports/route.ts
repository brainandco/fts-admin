import { auditLogFromRequest } from "@/lib/audit/log";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import archiver from "archiver";
import { ALL_EXPORT_KEYS } from "@/lib/exports/catalog";
import { asUuid, loadExportRows, resolveExportScope } from "@/lib/exports/build-rows";

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return lines.join("\n");
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function filenameFor(dataset: string, scopeSuffix: string): string {
  const extra = scopeSuffix ? `_${scopeSuffix}` : "";
  return `${dataset}${extra}_${stamp()}.csv`;
}

async function zipCsvFiles(files: { name: string; body: string }[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const archive = archiver("zip", { zlib: { level: 6 } });
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (c: Buffer) => chunks.push(c));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });
  for (const f of files) {
    archive.append(f.body, { name: f.name });
  }
  await archive.finalize();
  return done;
}

export async function GET(req: Request) {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const isAdmin = await can("approvals.approve");
  if (!isSuper && !isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const dataset = (url.searchParams.get("dataset") || "").trim();
  if (!dataset) return NextResponse.json({ message: "dataset is required" }, { status: 400 });
  const regionId = asUuid(url.searchParams.get("region_id"));
  const projectId = asUuid(url.searchParams.get("project_id"));

  const supabase = await createServerSupabaseClient();
  const scope = await resolveExportScope(supabase, regionId, projectId);
  const scopeSuffix = [regionId ? "region" : "", projectId ? "project" : ""].filter(Boolean).join("-");

  if (dataset === "all") {
    const files: { name: string; body: string }[] = [];
    let totalRows = 0;
    for (const key of ALL_EXPORT_KEYS) {
      const built = await loadExportRows(supabase, key, scope);
      if ("error" in built) continue;
      totalRows += built.rows.length;
      files.push({ name: filenameFor(key, scopeSuffix), body: toCsv(built.rows) });
    }
    await auditLogFromRequest(req, {
      actionType: "export",
      entityType: "export",
      actionCategory: "export",
      description: `Exported all datasets as ZIP (${totalRows} rows)`,
      meta: { dataset: "all", region_id: regionId, project_id: projectId, row_count: totalRows, file_count: files.length },
    });
    const zip = await zipCsvFiles(files);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="fts-exports${scopeSuffix ? `_${scopeSuffix}` : ""}_${stamp()}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const built = await loadExportRows(supabase, dataset, scope);
  if ("error" in built) return NextResponse.json({ message: built.error }, { status: 400 });

  await auditLogFromRequest(req, {
    actionType: "export",
    entityType: "export",
    actionCategory: "export",
    description: `Exported dataset: ${dataset} (${built.rows.length} rows)`,
    meta: { dataset, region_id: regionId, project_id: projectId, row_count: built.rows.length },
  });

  const csv = toCsv(built.rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameFor(dataset, scopeSuffix)}"`,
      "Cache-Control": "no-store",
    },
  });
}
