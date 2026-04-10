import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataClient } from "@/lib/supabase/server";
import { getEmployeeEmailSet, isPortalAdminByEmail } from "@/lib/delegations/participants";
import { NextResponse } from "next/server";

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const supabase = await getDataClient();
  const [delegatorRes, usersRes, employeeEmails] = await Promise.all([
    supabase.from("users_profile").select("is_super_user, email").eq("id", user.id).maybeSingle(),
    supabase.from("users_profile").select("id, email, full_name, is_super_user").neq("id", user.id).order("email"),
    getEmployeeEmailSet(supabase),
  ]);
  if (!isPortalAdminByEmail(delegatorRes.data?.email, employeeEmails)) {
    return NextResponse.json({ message: "Delegation is only available to admin users" }, { status: 403 });
  }
  const delegatorIsSuper = delegatorRes.data?.is_super_user ?? false;
  const users = usersRes.data ?? [];
  const adminOnly = users.filter((u) => {
    if (!isPortalAdminByEmail(u.email, employeeEmails)) return false;
    if (!delegatorIsSuper && u.is_super_user) return false;
    return true;
  });
  return NextResponse.json({ users: adminOnly });
}
