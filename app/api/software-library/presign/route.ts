import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { getWasabiBucket, getWasabiMaxUploadBytes, getWasabiS3Client } from "@/lib/wasabi/s3-client";
import { gateSoftwareLibrary } from "../gate";

const PRESIGN_EXPIRES_SEC = 3600;

function safeFileName(name: string): string {
  const n = (name || "file").trim().replace(/[^\w.\-()+ @&$=!*,?:;]/g, "_");
  return n.slice(0, 200) || "file.bin";
}

type Body = {
  title?: string;
  description?: string | null;
  fileName?: string;
  contentType?: string;
  byteSize?: number;
};

/** Create pending row + presigned PUT URL for direct upload to Wasabi. */
export async function POST(req: Request) {
  const g = await gateSoftwareLibrary();
  if (!g.ok || !g.profile?.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const description = body.description != null ? String(body.description).trim() || null : null;
  const fileName = safeFileName(String(body.fileName ?? ""));
  const contentType = String(body.contentType ?? "application/octet-stream").trim() || "application/octet-stream";
  const byteSize = typeof body.byteSize === "number" && Number.isFinite(body.byteSize) ? Math.floor(body.byteSize) : null;

  if (!title) return NextResponse.json({ message: "title is required" }, { status: 400 });
  if (!fileName) return NextResponse.json({ message: "fileName is required" }, { status: 400 });

  const maxBytes = getWasabiMaxUploadBytes();
  if (byteSize != null && byteSize > maxBytes) {
    return NextResponse.json({ message: `File size exceeds configured maximum (${maxBytes} bytes)` }, { status: 400 });
  }

  const id = randomUUID();
  const storageKey = `software/${id}/${fileName}`;

  const supabase = await getDataClient();
  const { error: insErr } = await supabase.from("portal_software").insert({
    id,
    title,
    description,
    storage_key: storageKey,
    file_name: fileName,
    mime_type: contentType,
    upload_status: "pending",
    uploaded_by: g.profile.id,
  });

  if (insErr) {
    return NextResponse.json({ message: insErr.message }, { status: 400 });
  }

  try {
    const client = getWasabiS3Client();
    const bucket = getWasabiBucket();
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: PRESIGN_EXPIRES_SEC });

    return NextResponse.json({
      id,
      uploadUrl,
      storageKey,
      expiresIn: PRESIGN_EXPIRES_SEC,
      headers: { "Content-Type": contentType },
    });
  } catch (e) {
    await supabase.from("portal_software").delete().eq("id", id);
    const msg = e instanceof Error ? e.message : "Wasabi presign failed";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
