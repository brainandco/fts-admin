import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

const CSV = `operator,service_type,sim_number,phone_number,notes
"STC","Data+Voice","8996601234567890123","+9665XXXXXXXX","Main corporate line"
"Mobily","Data","8996609876543210000","","Router data-only sim"
`;

export async function GET() {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return new NextResponse(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sims_import_template.csv",
    },
  });
}
