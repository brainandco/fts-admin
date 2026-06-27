import { NextResponse } from "next/server";

/** GET — no auth; use to verify Admin Lite mobile API is deployed (e.g. curl /api/mobile/health). */
export async function GET() {
  return NextResponse.json({ ok: true, service: "fts-admin-mobile" });
}
