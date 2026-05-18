import { redirect } from "next/navigation";
import { emailHasEmployeeRecord } from "@/lib/auth/employee-account";
import { getEmployeePortalBaseUrl } from "@/lib/email/employee-portal-base-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email && (await emailHasEmployeeRecord(user.email, supabase))) {
    const base = getEmployeePortalBaseUrl();
    redirect(`${base}/login?error=${encodeURIComponent("Use the Employee Portal to sign in. This is the Admin Portal.")}`);
  }

  if (user) redirect("/dashboard");
  redirect("/login");
}
