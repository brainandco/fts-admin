import { redirect } from "next/navigation";
import { getCurrentUserRolesAndPermissions } from "@/lib/rbac/permissions";

/** User creation is now "Add user" (invite) from Users. Redirect there. */
export default async function RegisterPage() {
  const { isSuper } = await getCurrentUserRolesAndPermissions();
  if (!isSuper) redirect("/login?message=" + encodeURIComponent("Only Super User can add users. Sign in as Super User."));
  redirect("/users/invite");
}
