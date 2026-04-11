import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { getWasabiBucket, getWasabiS3Client } from "@/lib/wasabi/s3-client";
import { gateSoftwareLibrary } from "../../gate";

type Body = { byteSize?: number };

/** After browser PUT to Wasabi, mark row active and set size from HeadObject. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateSoftwareLibrary();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  let body: Body = {};
  try {
    body = (await req.json().catch(() => ({}))) as Body;
  } catch {
    /* optional body */
  }

  const supabase = await getDataClient();
  const { data: row, error: fetchErr } = await supabase
    .from("portal_software")
    .select("id, storage_key, upload_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (row.upload_status === "active") {
    return NextResponse.json({ ok: true, message: "Already completed" });
  }

  try {
    const client = getWasabiS3Client();
    const bucket = getWasabiBucket();
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: row.storage_key,
      })
    );

    const size =
      typeof head.ContentLength === "number"
        ? head.ContentLength
        : typeof body.byteSize === "number"
          ? body.byteSize
          : null;

    if (size == null || size < 0) {
      return NextResponse.json({ message: "Could not determine object size" }, { status: 400 });
    }

    const { error: upErr } = await supabase
      .from("portal_software")
      .update({
        byte_size: size,
        upload_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (upErr) return NextResponse.json({ message: upErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, byte_size: size });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "HeadObject failed";
    await supabase.from("portal_software").update({ upload_status: "failed", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
