import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { deleteEmployeeById } from "@/lib/employees/delete-employee-internal";

const MAX_IDS = 200;

export async function POST(req: Request) {
  if (!(await can("employees.manage"))) {
    return NextResponse.json({ message: "You do not have permission to delete employees." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body.ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ message: "Request body must include a non-empty ids array." }, { status: 400 });
  }

  const ids = [...new Set(raw.map((id: unknown) => String(id).trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ message: "No valid ids." }, { status: 400 });
  }

  const deleted: string[] = [];
  const failed: { id: string; message: string; code?: string }[] = [];

  for (const id of ids) {
    const result = await deleteEmployeeById(id);
    if (result.ok) deleted.push(id);
    else failed.push({ id, message: result.message, ...(result.code ? { code: result.code } : {}) });
  }

  return NextResponse.json({
    deletedCount: deleted.length,
    failedCount: failed.length,
    deleted,
    failed,
  });
}
