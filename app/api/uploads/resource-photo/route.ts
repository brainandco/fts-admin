import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { createServerSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Admin uploads purchase/condition photos (service role → storage). */
export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ message: "Invalid form data" }, { status: 400 });

  const purpose = formData.get("purpose");
  if (purpose === "asset-purchase") {
    if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  } else if (purpose === "vehicle-purchase") {
    if (!(await can("vehicles.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  } else {
    return NextResponse.json({ message: "purpose must be asset-purchase or vehicle-purchase" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: "Image must be 5MB or smaller" }, { status: 400 });
  }
  const type = file.type || "";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ message: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }

  const admin = createServerSupabaseAdmin();
  const ext =
    type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const folder = purpose === "asset-purchase" ? "purchase/assets" : "purchase/vehicles";
  const path = `${folder}/${randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from("resource-photos").upload(path, buf, {
    contentType: type,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ message: upErr.message }, { status: 400 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("resource-photos").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path });
}
