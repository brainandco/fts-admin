import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireActive } from "@/lib/rbac/permissions";
import { BUCKET, avatarObjectPath, publicAvatarUrl } from "@/lib/profile/avatar-storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/** POST: upload profile image (multipart field "file"). */
export async function POST(request: NextRequest) {
  const access = await requireActive();
  if (!access.allowed || !access.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }

  const ext = extFromMime(mime);
  const path = avatarObjectPath(access.user.id, ext);
  const buf = Buffer.from(await file.arrayBuffer());

  const supabase = await createServerSupabaseClient();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const url = publicAvatarUrl(access.user.id, ext);
  if (!url) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { error: dbErr } = await supabase
    .from("users_profile")
    .update({ avatar_url: url })
    .eq("id", access.user.id);
  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, avatar_url: url });
}

/** DELETE: remove profile image. */
export async function DELETE() {
  const access = await requireActive();
  if (!access.allowed || !access.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: list } = await supabase.storage.from(BUCKET).list(access.user.id);
  const names = (list ?? []).map((o) => o.name).filter(Boolean);
  if (names.length) {
    await supabase.storage.from(BUCKET).remove(names.map((n) => `${access.user.id}/${n}`));
  }

  const { error } = await supabase
    .from("users_profile")
    .update({ avatar_url: null })
    .eq("id", access.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
