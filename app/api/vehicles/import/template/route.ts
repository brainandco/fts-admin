import { NextResponse } from "next/server";

const CSV = `plate_number,vehicle_type,rent_company,make,model,assignment_type
"ABC 1234","Pickup","RentCo","Toyota","Hilux","Temporary"`;

export async function GET() {
  return new NextResponse(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=vehicles_import_template.csv",
    },
  });
}
