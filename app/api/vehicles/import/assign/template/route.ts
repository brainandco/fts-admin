import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "Direct employee vehicle assignment is PM-only. Template is disabled in admin portal." },
    { status: 403 }
  );
}
