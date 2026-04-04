import { NextResponse } from "next/server";

const CSV = `full_name,passport_number,country,email,phone,iqama_number,roles,onboarding_date,status
"John Doe","A123456","USA","john@example.com","+1234567890","IQ001","DT;Driver/Rigger","2025-01-15",ACTIVE`;

export async function GET() {
  return new NextResponse(CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=employees_import_template.csv",
    },
  });
}
