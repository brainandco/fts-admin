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
    if (access.reason === "invitation_pending") redirect("/invite/accept");
    if (access.reason === "invitation_expired") redirect("/invite/expired");
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

  let positionLabel: string | null = null;
  if (isSuper) {
    positionLabel = "Super User";
  } else if (userId) {
    const { data: roleRows } = await supabase.from("user_roles").select("roles(name)").eq("user_id", userId);
    const names: string[] = [];
    for (const row of roleRows ?? []) {
      const r = (row as { roles: { name: string } | { name: string }[] | null }).roles;
      if (!r) continue;
      if (Array.isArray(r)) {
        for (const x of r) {
          if (x?.name) names.push(x.name);
        }
      } else if (r.name) {
        names.push(r.name);
      }
    }
    positionLabel = names.length ? [...new Set(names)].join(" · ") : "Administrator";
  }
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
        userProfile={
          access.profile
            ? {
                full_name: access.profile.full_name,
                email: access.profile.email,
                avatar_url: access.profile.avatar_url ?? null,
              }
            : null
        }
        unreadNotifications={unreadNotifications ?? 0}
        positionLabel={positionLabel}
      >
        {children}
      </DashboardChrome>
    </div>
  );
}
