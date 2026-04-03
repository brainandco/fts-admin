import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const supabase = await getDataClient();
  const [usersRes, employeesRes] = await Promise.all([
    supabase.from("users_profile").select("id, email, full_name").neq("id", user.id).order("email"),
    supabase.from("employees").select("email"),
  ]);
  const users = usersRes.data ?? [];
  const employeeEmails = new Set((employeesRes.data ?? []).map((e) => (e.email ?? "").toLowerCase().trim()).filter(Boolean));
  const adminOnly = users.filter((u) => !employeeEmails.has((u.email ?? "").toLowerCase().trim()));
  return NextResponse.json({ users: adminOnly });
}
