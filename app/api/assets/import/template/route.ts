import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";

const CSV = `name,category,model,serial,imei_1,imei_2,asset_id,purchase_date,warranty_end,condition,software_connectivity,company,ram,specs_json
"Dell Latitude 5520","Laptop","5520","DL5520-001","","","AST-1001","2024-06-01","2027-06-01","Good","probe, TEMS","Dell","16GB",""
"Company phone","Mobile","Galaxy A54","","353123456789012","","MOB-01","2024-01-15","","Good","","Samsung","",""
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
