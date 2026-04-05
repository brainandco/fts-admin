import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

const CSV = `company,category,model,serial,imei_1,imei_2,asset_id,condition,software_connectivity,ram
"Dell","Laptop","5520","DL5520-001","","","AST-1001","Good","probe, TEMS","16GB"
"Samsung","Mobile","Galaxy A54","","353123456789012","","MOB-01","Good","",""
`;

export async function GET() {
  if (!(await can("assets.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  return new NextResponse(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=assets_import_template.csv",
    },
  });
}
