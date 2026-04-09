import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { can, getCurrentUserProfile } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";
import { uploadResourcePhotosBuffer } from "@/lib/supabase/upload-resource-photos";

const MAX_BYTES = 25 * 1024 * 1024;

async function gate() {
  const { profile } = await getCurrentUserProfile();
  const isSuper = profile?.is_super_user === true;
  const okAdmin = await can("approvals.approve");
  if (!isSuper && !okAdmin) return { ok: false as const };
  return { ok: true as const, profile };
}

/** List company documents (admin + super user). */
export async function GET() {
  const g = await gate();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const supabase = await getDataClient();
  const { data, error } = await supabase
    .from("company_documents")
    .select("id, title, description, file_url, file_name, mime_type, is_leave_performa_template, uploaded_by, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ documents: data ?? [] });
}

/** Upload a company document (multipart: file, title, description?, is_leave_performa_template?). */
export async function POST(req: Request) {
  const g = await gate();
  if (!g.ok || !g.profile?.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ message: "Invalid form data" }, { status: 400 });

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const isLeaveTemplate = formData.get("is_leave_performa_template") === "true" || formData.get("is_leave_performa_template") === "on";
  const file = formData.get("file");

  if (!title) return NextResponse.json({ message: "title is required" }, { status: 400 });
  if (!file || !(file instanceof File)) return NextResponse.json({ message: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ message: "File must be 25MB or smaller" }, { status: 400 });

  const admin = createServerSupabaseAdmin();
  const safeName = (file.name || "document").replace(/[^\w.\-()+ ]/g, "_").slice(0, 180);
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
  const path = `company-docs/${randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";
  const { error: upErr } = await uploadResourcePhotosBuffer(admin, path, buf, contentType, { upsert: false });
  if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });

  const {
    data: { publicUrl },
  } = admin.storage.from("resource-photos").getPublicUrl(path);

  const supabase = await getDataClient();

  if (isLeaveTemplate) {
    await supabase.from("company_documents").update({ is_leave_performa_template: false }).eq("is_leave_performa_template", true);
  }

  const { data: row, error: insErr } = await supabase
    .from("company_documents")
    .insert({
      title,
      description,
      file_url: publicUrl,
      file_name: safeName,
      mime_type: contentType,
      is_leave_performa_template: isLeaveTemplate,
      uploaded_by: g.profile.id,
    })
    .select("id")
    .single();

  if (insErr) return NextResponse.json({ message: insErr.message }, { status: 400 });
  return NextResponse.json({ id: row.id, url: publicUrl });
}
