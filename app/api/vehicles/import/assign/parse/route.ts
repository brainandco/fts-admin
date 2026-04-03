import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

export async function POST() {
  if (!(await can("vehicles.manage"))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { message: "Direct employee vehicle assignment is PM-only. Use Project Manager workflow." },
    { status: 403 }
  );
}
