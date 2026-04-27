import { getDataClient } from "@/lib/supabase/server";
import { PERMISSION_EMPLOYEE_FILES_MANAGE } from "@/lib/rbac/permission-codes";
import { can } from "@/lib/rbac/permissions";
import { NextResponse } from "next/server";

/** GET /api/employee-files?regionId= — list files in a region (all employees). */
export async function GET(req: Request) {
  if (!(await can(PERMISSION_EMPLOYEE_FILES_MANAGE))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const regionId = new URL(req.url).searchParams.get("regionId")?.trim();
  if (!regionId) {
    return NextResponse.json({ message: "regionId query parameter is required" }, { status: 400 });
  }

  const supabase = await getDataClient();
  const { data: files, error } = await supabase
    .from("employee_personal_files")
    .select("id, file_name, mime_type, byte_size, upload_status, created_at, employee_id")
    .eq("region_id", regionId)
    .eq("upload_status", "active")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  const empIds = [...new Set((files ?? []).map((f) => f.employee_id))];
  const { data: emps } = empIds.length
    ? await supabase.from("employees").select("id, full_name, email").in("id", empIds)
    : { data: [] };
  const empMap = new Map((emps ?? []).map((e) => [e.id, e] as const));
  const list = (files ?? []).map((f) => {
    const e = empMap.get(f.employee_id);
    return {
      id: f.id,
      fileName: f.file_name,
      mimeType: f.mime_type,
      byteSize: f.byte_size,
      createdAt: f.created_at,
      employeeId: f.employee_id,
      employeeName: e?.full_name ?? "—",
      employeeEmail: e?.email ?? null,
    };
  });
  return NextResponse.json({ files: list });
}
