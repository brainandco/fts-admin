import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { getWasabiBucket, getWasabiS3Client } from "@/lib/wasabi/s3-client";
import { gateSoftwareLibrary } from "../gate";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gateSoftwareLibrary();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  const supabase = await getDataClient();
  const { data: row, error: fetchErr } = await supabase
    .from("portal_software")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) return NextResponse.json({ message: "Not found" }, { status: 404 });

  try {
    const client = getWasabiS3Client();
    const bucket = getWasabiBucket();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: row.storage_key,
      })
    );
  } catch {
    /* continue to delete DB row even if object missing */
  }

  const { error: delErr } = await supabase.from("portal_software").delete().eq("id", id);
  if (delErr) return NextResponse.json({ message: delErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
