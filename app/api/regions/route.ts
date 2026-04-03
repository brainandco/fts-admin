import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { can } from "@/lib/rbac/permissions";
import { auditLog } from "@/lib/audit/log";

export async function POST(req: Request) {
  if (!(await can("regions.manage"))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, code } = body;
  if (!name || typeof name !== "string") return NextResponse.json({ message: "Name required" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("regions").insert({ name: name.trim(), code: code || null }).select("id").single();
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  await auditLog({ actionType: "create", entityType: "region", entityId: data.id, newValue: { name, code }, description: "Region created" });
  return NextResponse.json(data);
}
