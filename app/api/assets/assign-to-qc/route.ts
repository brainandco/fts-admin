import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

/** Employee assignment is PM-only in Employee Portal. */
export async function POST() {
  if (!(await can("assets.manage")) && !(await can("assets.assign"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { message: "Direct employee assignment is PM-only. Use Project Manager workflow in Employee Portal." },
    { status: 403 }
  );
}
