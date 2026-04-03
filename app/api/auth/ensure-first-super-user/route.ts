import { NextResponse } from "next/server";

/**
 * Super user creation is no longer supported (single super user is seeded).
 * No-op for backwards compatibility with any clients that still call this.
 */
export async function POST() {
  return NextResponse.json({ promoted: false, message: "Super user creation is not supported" });
}
