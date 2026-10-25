import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDataClient } from "@/lib/supabase/server";
import { requirePettyAdmin } from "@/lib/petty-cash/admin-auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePettyAdmin(false);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const supabase = await getDataClient();
  const { data, error } = await supabase.from("purchase_invoices").select("qr_payload, is_vat").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  if (!data?.is_vat || !data.qr_payload) {
    return NextResponse.json({ message: "This invoice has no QR" }, { status: 404 });
  }
  const png = await QRCode.toBuffer(data.qr_payload, { errorCorrectionLevel: "M", margin: 2, width: 360, type: "png" });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
