import { NextResponse } from "next/server";
import { getDataClient } from "@/lib/supabase/server";
import { gateSoftwareLibrary } from "./gate";

/** List software library entries (admin). */
export async function GET() {
  const g = await gateSoftwareLibrary();
  if (!g.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const supabase = await getDataClient();
  const { data, error } = await supabase
    .from("portal_software")
    .select("id, title, description, storage_key, file_name, mime_type, byte_size, upload_status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}
