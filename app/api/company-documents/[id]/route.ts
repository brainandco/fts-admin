import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

async function gate() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const okAdmin = await can("approvals.approve");
  if (!isSuper && !okAdmin) return false;
  return true;
}

/** Delete a company document (removes DB row; storage object may remain orphaned). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const supabase = await getDataClient();
  const { data: row } = await supabase.from("company_documents").select("file_url").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const url = typeof row.file_url === "string" ? row.file_url : "";
  const marker = "/storage/v1/object/public/resource-photos/";
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const objectPath = decodeURIComponent(url.slice(idx + marker.length));
    const admin = createServerSupabaseAdmin();
    await admin.storage.from("resource-photos").remove([objectPath]);
  }

  const { error } = await supabase.from("company_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
