import { redirect } from "next/navigation";
import { requireActive, getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";
import { getDataClient } from "@/lib/supabase/server";
import { DashboardChrome } from "@/components/layout/DashboardChrome";

/** Employees (any role) use the Employee Portal only; they must not access the admin panel. */
async function isAnyEmployee(email: string): Promise<boolean> {
  const supabase = await getDataClient();
  const { data: emp } = await supabase.from("employees").select("id").eq("email", email.toLowerCase().trim()).maybeSingle();
  return !!emp;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireActive();
  if (!access.allowed) {
    if (access.reason === "unauthenticated") redirect("/login?redirect=" + encodeURIComponent("/dashboard"));
    if (access.reason === "no_profile") redirect("/api/auth/ensure-profile?next=" + encodeURIComponent("/dashboard"));
    if (access.reason === "disabled") redirect("/account-disabled");
    redirect("/login");
  }
  const email = (access.user?.email ?? "").trim();
  if (email && (await isAnyEmployee(email))) {
    redirect("/api/auth/employee-portal-only");
  }
  const { isSuper, permissions } = await getCurrentUserRolesAndPermissions();
  const permissionList = Array.from(permissions);
  const supabase = await getDataClient();
  const userId = access.user?.id ?? null;
  const { count: unreadNotifications } = userId
    ? await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", userId)
        .eq("is_read", false)
    : { count: 0 };

  return (
    <div className="fts-app-shell min-h-dvh">
      <DashboardChrome
        isSuper={!!isSuper}
        permissions={permissionList}
        userProfile={access.profile ? { full_name: access.profile.full_name, email: access.profile.email } : null}
        unreadNotifications={unreadNotifications ?? 0}
      >
        {children}
      </DashboardChrome>
    </div>
  );
}
