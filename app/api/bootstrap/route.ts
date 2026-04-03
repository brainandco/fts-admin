import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BOOTSTRAP_TOKEN = process.env.FTS_BOOTSTRAP_SUPER_USER_TOKEN;

export async function POST(req: Request) {
  if (!BOOTSTRAP_TOKEN) return NextResponse.json({ message: "Bootstrap not configured" }, { status: 404 });
  const body = await req.json();
  const token = body.token;
  const email = body.email;
  if (token !== BOOTSTRAP_TOKEN || !email) return NextResponse.json({ message: "Invalid token or email" }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase.from("users_profile").select("id").eq("email", email).single();
  if (!profile) return NextResponse.json({ message: "User not found" }, { status: 404 });
  const { data: existing } = await supabase.from("users_profile").select("is_super_user").eq("id", profile.id).single();
  if (existing?.is_super_user) return NextResponse.json({ message: "User is already Super User" }, { status: 400 });
  const { error } = await supabase.from("users_profile").update({ is_super_user: true, status: "ACTIVE" }).eq("id", profile.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Super User granted. Remove FTS_BOOTSTRAP_SUPER_USER_TOKEN from env." });
}
